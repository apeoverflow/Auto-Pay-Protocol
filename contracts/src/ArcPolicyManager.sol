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
error PolicyAlreadyExists();
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
    mapping(address => bytes32[]) public payerPolicyIds;
    mapping(address => bytes32[]) public merchantPolicyIds;

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
    ) external returns (bytes32 policyId) {
        if (merchant == address(0)) revert InvalidMerchant();
        if (chargeAmount == 0) revert InvalidAmount();
        if (interval < MIN_INTERVAL || interval > MAX_INTERVAL) revert InvalidInterval();

        policyId = keccak256(abi.encodePacked(msg.sender, merchant, block.timestamp, policyCount++));

        bytes32 existingId = _findActivePolicy(msg.sender, merchant);
    }

    function revokePolicy(bytes32 policyId) external {}

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <---------- Relayer Functions ------------>
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    function charge(bytes32 policyId) external nonReentrant {}

    function batchCharge(bytes32[] calldata policyIds) external returns (bool[] memory results) {}

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <----------- View Functions -------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    function canCharge(bytes32 policyId) external view returns (bool, string memory) {}

    function getChargeablePolicies(address merchant) external view returns (bytes32[] memory) {}

    function getPayerPolicies(address payer) external view returns (bytes32[] memory) {}

    function getMerchantPolicies(address merchant) external view returns (bytes32[] memory) {}

    function getNextChargeTime(bytes32 policyId) external view returns (uint256) {}

    function getRemainingAllowance(bytes32 policyId) external view returns (uint128) {}

    function getStats() external view returns (uint256, uint256, uint256) {}

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <----------- Admin Functions ------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    function withdrawFees() external {}

    function setFeeRecipient(address newRecipient) external onlyOwner {
        feeRecipient = newRecipient;
    }

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <-------------- Internal ----------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    function _findActivePolicy(address payer, address merchant) internal view returns (bytes32) {}
}
