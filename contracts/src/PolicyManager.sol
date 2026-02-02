// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PolicyManager {

    struct Policy {
        bytes32 merchantOnArc; // CCTP recipient
        address consumer;
        uint256 chargeAmountUsd; // 1_000_000 = 1 USDC
        uint256 intervalDuration; // seconds
        uint256 start;
        uint256 lastCharged;
        bool active;
    }

    mapping(bytes32 => Policy) public policies; // policyId -> policy
    mapping(address => bytes32[]) public consumerPolicyIds;
    mapping(bytes32 => bytes32[]) public merchantPolicyIds; // CCTP recipient -> policyIds

    uint256 public policyCount;
    uint256 public accumulatedFees;

    

    function createPolicy 
        (bytes32 merchantOnArc, uint256 amount, uint256 interval, uint256 chargeAmountUsd)
        external returns (bytes32 policyId)
    { 
        
    }

    function getChargablePolicies(bytes32 merchantOnArc) external returns (bytes32[] memory policyIds) { }

    function batchChargeConsumers(bytes32[] memory policyIds) external { }
    
    function chargeConsumer(bytes32 policyId) public { }

    function settlePaymentViaCCTP (bytes32 policyId) private { }

    function extractProtocolFee () private { }


}
