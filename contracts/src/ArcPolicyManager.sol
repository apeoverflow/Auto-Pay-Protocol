// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/*

    
                          ÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆ
                     ÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆ
                  ÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆ
               ÆÆÆÆÆÆÆÆÆÆÆÆÆ            ÆÆÆÆÆÆÆÆÆÆÆÆÆ
             ÆÆÆÆÆÆÆÆÆÆ                      ÆÆÆÆÆÆÆÆÆÆ   ÆÆ
           ÆÆÆÆÆÆÆÆÆ                            ÆÆÆÆÆÆÆÆÆÆÆÆ
          ÆÆÆÆÆÆÆÆ                                ÆÆÆÆÆÆÆÆÆÆ
         ÆÆÆÆÆÆÆ                                ÆÆÆÆÆÆÆÆÆÆÆÆ
        ÆÆÆÆÆÆÆ          ÆÆÆÆ                              ÆÆÆÆÆ
       ÆÆÆÆÆÆÆ           ÆÆÆÆÆÆÆ                      ÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆ
      ÆÆÆÆÆÆÆ            ÆÆÆÆÆÆÆÆÆÆ                 ÆÆÆÆ   ÆÆÆÆÆ   ÆÆÆÆ
      ÆÆÆÆÆÆ             ÆÆÆÆÆÆÆÆÆÆÆÆÆ            ÆÆÆ  ÆÆÆÆÆÆÆÆÆÆÆÆÆ  ÆÆÆ
     ÆÆÆÆÆÆÆ             ÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆ        ÆÆÆ ÆÆÆÆÆÆÆ   ÆÆÆÆÆÆ  ÆÆÆ
     ÆÆÆÆÆÆ              ÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆ    ÆÆ  ÆÆÆÆÆ  ÆÆÆ ÆÆÆÆÆÆ  ÆÆ
     ÆÆÆÆÆÆ              ÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆ ÆÆÆ ÆÆÆÆÆÆ  ÆÆÆÆÆÆÆÆÆÆÆ ÆÆÆ
     ÆÆÆÆÆÆ              ÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆ   ÆÆÆ ÆÆÆÆÆÆÆÆ    ÆÆÆÆÆÆÆ ÆÆÆ
     ÆÆÆÆÆÆÆ             ÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆ       ÆÆ ÆÆÆÆÆÆÆÆÆÆÆ  ÆÆÆÆÆÆ ÆÆ
      ÆÆÆÆÆÆ             ÆÆÆÆÆÆÆÆÆÆÆÆÆÆ          ÆÆ  ÆÆÆÆÆ      ÆÆÆÆÆÆ ÆÆÆ
      ÆÆÆÆÆÆÆ            ÆÆÆÆÆÆÆÆÆÆ               ÆÆÆ ÆÆÆÆÆÆÆ ÆÆÆÆÆÆ  ÆÆÆ
       ÆÆÆÆÆÆÆ           ÆÆÆÆÆÆÆ                   ÆÆÆÆ  ÆÆÆÆÆÆÆÆÆ   ÆÆÆ
       ÆÆÆÆÆÆÆÆ          ÆÆÆÆ                        ÆÆÆÆ  ÆÆÆÆ   ÆÆÆÆ
        ÆÆÆÆÆÆÆÆ                                    Æ    ÆÆÆÆÆÆÆÆÆÆ
         ÆÆÆÆÆÆÆÆÆ                                ÆÆÆÆÆÆÆ
           ÆÆÆÆÆÆÆÆÆ                            ÆÆÆÆÆÆÆÆÆ
             ÆÆÆÆÆÆÆÆÆÆ                      ÆÆÆÆÆÆÆÆÆÆ
               ÆÆÆÆÆÆÆÆÆÆÆÆ             ÆÆÆÆÆÆÆÆÆÆÆÆÆ
                 ÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆ
                    ÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆ
                         ÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆÆ


                  ╔══════════════════════════════╗
                  ║       AutoPay Protocol       ║
                  ╚══════════════════════════════╝
*/

/**
 * @title ArcPolicyManager
 * @author AutoPay Protocol
 * @notice Manages subscription policies on Arc (settlement chain)
 * @dev Arc-native version with direct USDC transfers (no CCTP bridging).
 *      Users create policies that authorize recurring charges. Relayers
 *      execute charges when due, transferring USDC directly to merchants.
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
// <--------------- Errors ------------------>
// >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

error InvalidMerchant();
error InvalidAmount();
error InvalidInterval();
error PolicyNotActive();
error TooSoonToCharge();
error SpendingCapExceeded();
error InsufficientAllowance();
error InsufficientBalance();
error NotPolicyOwner();
error NothingToWithdraw();

contract ArcPolicyManager is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <--------------- Constants --------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    uint256 public constant MIN_INTERVAL = 1 hours;
    uint256 public constant MAX_INTERVAL = 365 days;
    uint256 public constant PROTOCOL_FEE_BPS = 250; // 2.5%
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <------------- Immutables ---------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    IERC20 public immutable USDC;

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <--------------- State ------------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    struct Policy {
        address payer;           // Who gets charged
        address merchant;        // Recipient on Arc (native address)
        uint128 chargeAmount;    // Amount per charge (6 decimals)
        uint128 spendingCap;     // Max total policy lifetime spend (0 = unlimited)
        uint128 totalSpent;      // Running total charged
        uint32 interval;         // Seconds between charges
        uint32 lastCharged;      // Timestamp of last charge
        uint32 chargeCount;      // Number of successful charges
        uint32 endTime;          // 0 = active, non-zero = timestamp when policy ended
        bool active;             // Can be charged
        string metadataUrl;      // Off-chain metadata (plan details, terms, etc.)
    }

    mapping(bytes32 => Policy) public policies;

    uint256 public policyCount;
    uint256 public accumulatedFees;
    address public feeRecipient;

    // Stats
    uint256 public totalPoliciesCreated;
    uint256 public totalChargesProcessed;
    uint256 public totalVolumeProcessed;

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <--------------- Events ------------------>
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    event PolicyCreated(
        bytes32 indexed policyId,
        address indexed payer,
        address indexed merchant,
        uint128 chargeAmount,
        uint32 interval,
        uint128 spendingCap,
        string metadataUrl
    );

    event PolicyRevoked(
        bytes32 indexed policyId,
        address indexed payer,
        address indexed merchant,
        uint32 endTime
    );

    event ChargeSucceeded(
        bytes32 indexed policyId,
        address indexed payer,
        address indexed merchant,
        uint128 amount,
        uint128 protocolFee
    );

    event ChargeFailed(bytes32 indexed policyId, string reason);

    event FeesWithdrawn(address indexed recipient, uint256 amount);

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <------------- Constructor --------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    constructor(
        address _usdc,
        address _feeRecipient
    ) Ownable(msg.sender) {
        USDC = IERC20(_usdc);
        feeRecipient = _feeRecipient;
    }

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <----------- Payer Functions ------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    function createPolicy(
        address merchant,
        uint128 chargeAmount,
        uint32 interval,
        uint128 spendingCap,
        string calldata metadataUrl
    ) external nonReentrant returns (bytes32 policyId) {
        if (merchant == address(0)) revert InvalidMerchant();
        if (chargeAmount == 0) revert InvalidAmount();
        if (interval < MIN_INTERVAL || interval > MAX_INTERVAL) revert InvalidInterval();

        // Verify payer has sufficient balance and allowance for first charge
        if (USDC.allowance(msg.sender, address(this)) < chargeAmount) revert InsufficientAllowance();
        if (USDC.balanceOf(msg.sender) < chargeAmount) revert InsufficientBalance();

        policyId = keccak256(abi.encodePacked(msg.sender, merchant, block.timestamp, policyCount++));

        policies[policyId] = Policy({
            payer: msg.sender,
            merchant: merchant,
            chargeAmount: chargeAmount,
            spendingCap: spendingCap,
            totalSpent: chargeAmount,
            interval: interval,
            lastCharged: uint32(block.timestamp),
            chargeCount: 1,
            endTime: 0,
            active: true,
            metadataUrl: metadataUrl
        });

        totalPoliciesCreated++;
        totalChargesProcessed++;
        totalVolumeProcessed += chargeAmount;

        emit PolicyCreated(policyId, msg.sender, merchant, chargeAmount, interval, spendingCap, metadataUrl);

        // Execute first charge
        USDC.safeTransferFrom(msg.sender, address(this), chargeAmount);

        uint256 protocolFee = _calculateProtocolFee(chargeAmount);
        accumulatedFees += protocolFee;
        uint256 merchantAmount = chargeAmount - protocolFee;

        USDC.safeTransfer(merchant, merchantAmount);

        emit ChargeSucceeded(policyId, msg.sender, merchant, uint128(merchantAmount), uint128(protocolFee));
    }

    function revokePolicy(bytes32 policyId) external {
        Policy storage policy = policies[policyId];
        if (policy.payer != msg.sender) revert NotPolicyOwner();
        if (!policy.active) revert PolicyNotActive();

        policy.active = false;
        policy.endTime = uint32(block.timestamp);
        emit PolicyRevoked(policyId, msg.sender, policy.merchant, policy.endTime);
    }

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <---------- Relayer Functions ------------>
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    function charge(bytes32 policyId) external nonReentrant {
        Policy storage policy = policies[policyId];

        if (!policy.active) revert PolicyNotActive();
        if (block.timestamp < policy.lastCharged + policy.interval) {
            revert TooSoonToCharge();
        }
        if (policy.spendingCap > 0 && policy.totalSpent + policy.chargeAmount > policy.spendingCap) {
            revert SpendingCapExceeded();
        }

        uint256 chargeAmount = policy.chargeAmount;
        address payer = policy.payer;
        address merchant = policy.merchant;

        if (USDC.allowance(payer, address(this)) < chargeAmount) revert InsufficientAllowance();
        if (USDC.balanceOf(payer) < chargeAmount) revert InsufficientBalance();

        // update state
        policy.lastCharged = uint32(block.timestamp);
        policy.totalSpent += policy.chargeAmount;
        policy.chargeCount++;
        totalChargesProcessed++;
        totalVolumeProcessed += policy.chargeAmount;

        // pull from payer
        USDC.safeTransferFrom(payer, address(this), chargeAmount);

        // calculate fee
        uint256 protocolFee = _calculateProtocolFee(chargeAmount);
        accumulatedFees += protocolFee;
        uint256 merchantAmount = chargeAmount - protocolFee;

        // send to merchant
        USDC.safeTransfer(merchant, merchantAmount);

        emit ChargeSucceeded(policyId, payer, merchant, uint128(merchantAmount), uint128(protocolFee));
    }

    function batchCharge(bytes32[] calldata policyIds) external returns (bool[] memory results) {
        results = new bool[](policyIds.length);
        for (uint256 i = 0; i < policyIds.length; i++) {
            try this.charge(policyIds[i]) {
                results[i] = true;
            } catch {
                results[i] = false;
                emit ChargeFailed(policyIds[i], "Charge reverted");
            }
        }
    }

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <------------ View Functions ------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    function canCharge(bytes32 policyId) external view returns (bool, string memory) {
        Policy storage policy = policies[policyId];

        if (!policy.active) return (false, "Policy not active");
        if (block.timestamp < policy.lastCharged + policy.interval) {
            return (false, "Too soon to charge");
        }
        if (policy.spendingCap > 0 && policy.totalSpent + policy.chargeAmount > policy.spendingCap) {
            return (false, "Spending cap exceeded");
        }
        if (USDC.allowance(policy.payer, address(this)) < policy.chargeAmount) {
            return (false, "Insufficient allowance");
        }
        if (USDC.balanceOf(policy.payer) < policy.chargeAmount) {
            return (false, "Insufficient balance");
        }

        return (true, "");
    }

    function getNextChargeTime(bytes32 policyId) external view returns (uint256) {
        Policy storage policy = policies[policyId];
        if (!policy.active) return 0;
        return policy.lastCharged + policy.interval;
    }

    function getRemainingAllowance(bytes32 policyId) external view returns (uint128) {
        Policy storage policy = policies[policyId];
        if (!policy.active) return 0;
        if (policy.spendingCap == 0) return type(uint128).max;
        if (policy.totalSpent >= policy.spendingCap) return 0;
        return policy.spendingCap - policy.totalSpent;
    }

    function getChargeBreakdown(bytes32 policyId) external view returns (
        uint256 total,
        uint256 merchantReceives,
        uint256 protocolFee
    ) {
        Policy storage policy = policies[policyId];
        total = policy.chargeAmount;
        protocolFee = _calculateProtocolFee(total);
        merchantReceives = total - protocolFee;
    }

    function getStats() external view returns (uint256, uint256, uint256) {
        return (totalPoliciesCreated, totalChargesProcessed, totalVolumeProcessed);
    }

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <----------- Admin Functions ------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    function withdrawFees() external {
        uint256 fees = accumulatedFees;
        if (fees == 0) revert NothingToWithdraw();
        accumulatedFees = 0;
        USDC.safeTransfer(feeRecipient, fees);
        emit FeesWithdrawn(feeRecipient, fees);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        feeRecipient = newRecipient;
    }


    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <-------------- Internal ----------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    function _calculateProtocolFee(uint256 amount) internal pure returns (uint256) {
        return (amount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
    }

}
