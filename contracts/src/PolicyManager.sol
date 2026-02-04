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
 * @title PolicyManager
 * @author AutoPay Protocol
 * @notice Manages subscription policies on source chains (Polygon, Arbitrum)
 * @dev Charges are bridged to Arc via Circle CCTP V2. Users create policies
 *      that authorize recurring charges. Relayers execute charges when due,
 *      burning USDC on the source chain and minting on Arc for the merchant.
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";


interface ITokenMessengerV2 {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,  // bytes32(0) = anyone can call receiveMessage
        uint256 maxFee,             // max fee in burn token units (e.g., 1000 = 0.001 USDC)
        uint32 minFinalityThreshold // 1000 = Fast Transfer, 2000 = Standard Transfer
    ) external returns (uint64 nonce);
}

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

contract PolicyManager is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <--------------- Constants --------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    uint32 public constant ARC_DOMAIN = 26;
    uint256 public constant MIN_INTERVAL = 1 hours;
    uint256 public constant MAX_INTERVAL = 365 days;
    uint256 public constant PROTOCOL_FEE_BPS = 250; // 2.5%
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <------------- Immutables ---------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    IERC20 public immutable USDC;
    ITokenMessengerV2 public immutable TOKEN_MESSENGER;

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <--------------- State ------------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    struct Policy {
        address payer;           // Who gets charged
        bytes32 merchantOnArc;   // Recipient on Arc (CCTP bytes32 format)
        uint128 chargeAmount;    // Amount per charge (6 decimals)
        uint128 spendingCap;     // Max total policy lifetime spend (0 = unlimited)
        uint128 totalSpent;      // Running total charged
        uint32 interval;         // Seconds between charges
        uint32 lastCharged;      // Timestamp of last charge
        bool active;             // Can be charged
        string metadataUrl;      // Off-chain metadata (plan details, terms, etc.)
    }

    mapping(bytes32 => Policy) public policies;

    uint256 public policyCount;
    uint256 public accumulatedFees;
    address public feeRecipient;

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <--------------- Events ------------------>
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    event Policycreated(
        bytes32 indexed policyId,
        address indexed payer,
        bytes32 indexed merchantOnArc,
        uint128 chargeAmount,
        uint32 interval,
        uint128 spendingCap,
        string metadataUrl
    );

    event PolicyRevoked(
        bytes32 indexed policyId,
        address indexed payer,
        bytes23 indexed merchantOnArc
    );

    event ChargeSucceeded(
        bytes32 indexed policyId,
        address indexed payer,
        bytes32 indexed merchantOnArc,
        uint128 amount,
        uint128 protocolFee,
        uint64 cctpNonce
    );

    event ChargeFailed(bytes32 indexed policyId, string reason);

    event FeesWithdrawn(address indexed recipient, uint256 amount);

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <-------------- Constructor -------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    constructor (
        address _usdc,
        address _tokenMessenger,
        address _feeRecipient
    ) Ownable(msg.sender) {
        USDC = IERC20(_usdc);
        TOKEN_MESSENGER = ITokenMessengerV2(_tokenMessenger);
        feeRecipient = _feeRecipient;
    }


    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <----------- Payer Functions ------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    function createPolicy(
        bytes32 merchantOnArc,
        uint128 chargeAmount,
        uint32 interval,
        uint128 spendingCap,
        string calldata metadataUrl
    ) external returns (bytes32 policyId) {}

    function revokePolicy(bytes32 policyId) external {}


    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <---------- Relayer Functions ------------>
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    function charge(bytes32 policyId) external nonReentrant returns (uint64 cctpNonce) {}

    function batchCharge(bytes32[] calldata policyIds) external returns (uint256 successCount) {}

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <----------- View Functions -------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    function canCharge(bytes32 policyId) external view returns (bool, string memory) {}

    function getNextChargeTime(bytes32 policyId) external view returns (uint256) {}

    function getRemainingAllowance(bytes32 policyId) external view returns (uint128) {}

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <----------- Admin Functions ------------->
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    function withdrawFees() external {}

    function setFeeRecipient(address newRecipient) external onlyOwner {
        feeRecipient = newRecipient;
    }

    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<
    // <---------------- Utils ------------------>
    // >>>>>>>>>>>>-----------------<<<<<<<<<<<<<<

    function addressToBytes32(address addr) external pure returns (bytes32) {}

    function bytes32ToAddress(bytes32 b) external pure returns (address) {}
}
