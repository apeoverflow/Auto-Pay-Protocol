// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ArcPolicyManager} from "../src/ArcPolicyManager.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract ArcPolicyManagerTest is Test {
    ArcPolicyManager public manager;
    MockUSDC public usdc;

    address public owner = address(this);
    address public feeRecipient = makeAddr("feeRecipient");
    address public payer = makeAddr("payer");
    address public merchant = makeAddr("merchant");

    uint128 public constant CHARGE_AMOUNT = 10e6; // 10 USDC
    uint32 public constant INTERVAL = 30 days;
    uint128 public constant SPENDING_CAP = 100e6; // 100 USDC

    function setUp() public {
        usdc = new MockUSDC();
        manager = new ArcPolicyManager(address(usdc), feeRecipient);

        // give payer some usdc
        usdc.mint(payer, 1000e6);
    }

    // --- Constructor ---

    function test_Constructor() public view {
        assertEq(address(manager.USDC()), address(usdc));
        assertEq(manager.feeRecipient(), feeRecipient);
        assertEq(manager.owner(), owner);
    }

    // --- createPolicy ---
    // NOTE: createPolicy now executes the first charge immediately

    function test_CreatePolicy_Success() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);

        uint256 payerBalanceBefore = usdc.balanceOf(payer);
        uint256 merchantBalanceBefore = usdc.balanceOf(merchant);

        bytes32 policyId = manager.createPolicy(
            merchant,
            CHARGE_AMOUNT,
            INTERVAL,
            SPENDING_CAP,
            "https://example.com/plan"
        );
        vm.stopPrank();

        assertTrue(policyId != bytes32(0));
        assertEq(manager.policyCount(), 1);

        // Verify first charge was executed
        uint256 protocolFee = (CHARGE_AMOUNT * manager.PROTOCOL_FEE_BPS()) / manager.BPS_DENOMINATOR();
        uint256 merchantAmount = CHARGE_AMOUNT - protocolFee;

        assertEq(usdc.balanceOf(payer), payerBalanceBefore - CHARGE_AMOUNT);
        assertEq(usdc.balanceOf(merchant), merchantBalanceBefore + merchantAmount);
        assertEq(manager.accumulatedFees(), protocolFee);

        // check the policy was stored correctly (with first charge applied)
        (
            address storedPayer,
            address storedMerchant,
            uint128 chargeAmount,
            uint128 spendingCap,
            uint128 totalSpent,
            uint32 interval,
            uint32 lastCharged,
            uint32 chargeCount,
            uint8 consecutiveFailures,
            uint32 endTime,
            bool active,
        ) = manager.policies(policyId);

        assertEq(storedPayer, payer);
        assertEq(storedMerchant, merchant);
        assertEq(chargeAmount, CHARGE_AMOUNT);
        assertEq(spendingCap, SPENDING_CAP);
        assertEq(totalSpent, CHARGE_AMOUNT); // First charge applied
        assertEq(interval, INTERVAL);
        assertEq(lastCharged, block.timestamp); // Set to now
        assertEq(chargeCount, 1); // First charge counted
        assertEq(consecutiveFailures, 0);
        assertEq(endTime, 0);
        assertTrue(active);
    }

    function test_CreatePolicy_RevertInvalidMerchant() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        vm.expectRevert(abi.encodeWithSignature("InvalidMerchant()"));
        manager.createPolicy(address(0), CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();
    }

    function test_CreatePolicy_RevertInvalidAmount() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        vm.expectRevert(abi.encodeWithSignature("InvalidAmount()"));
        manager.createPolicy(merchant, 0, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();
    }

    function test_CreatePolicy_RevertInvalidInterval_TooShort() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        vm.expectRevert(abi.encodeWithSignature("InvalidInterval()"));
        manager.createPolicy(merchant, CHARGE_AMOUNT, 30 seconds, SPENDING_CAP, "");
        vm.stopPrank();
    }

    function test_CreatePolicy_RevertInvalidInterval_TooLong() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        vm.expectRevert(abi.encodeWithSignature("InvalidInterval()"));
        manager.createPolicy(merchant, CHARGE_AMOUNT, 366 days, SPENDING_CAP, "");
        vm.stopPrank();
    }

    function test_CreatePolicy_RevertInsufficientAllowance() public {
        // No approval given
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSignature("InsufficientAllowance()"));
        manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
    }

    function test_CreatePolicy_RevertInsufficientBalance() public {
        address brokePayer = makeAddr("brokePayer");
        // Has approval but no balance
        vm.startPrank(brokePayer);
        usdc.approve(address(manager), type(uint256).max);
        vm.expectRevert(abi.encodeWithSignature("InsufficientBalance()"));
        manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();
    }

    // --- revokePolicy ---

    function test_RevokePolicy_Success() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        manager.revokePolicy(policyId);
        vm.stopPrank();

        (,,,,,,,,, uint32 endTime, bool active,) = manager.policies(policyId);
        assertFalse(active);
        assertEq(endTime, block.timestamp);
    }

    function test_RevokePolicy_RevertNotPolicyOwner() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        // merchant tries to revoke payer's policy
        vm.prank(merchant);
        vm.expectRevert(abi.encodeWithSignature("NotPolicyOwner()"));
        manager.revokePolicy(policyId);
    }

    function test_RevokePolicy_RevertPolicyNotActive() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        manager.revokePolicy(policyId);

        // can't revoke twice
        vm.expectRevert(abi.encodeWithSignature("PolicyNotActive()"));
        manager.revokePolicy(policyId);
        vm.stopPrank();
    }

    // --- charge ---
    // NOTE: First charge happens on createPolicy, so charge() is for subsequent charges

    function test_Charge_Success() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        // First charge already happened, need to wait for interval
        vm.warp(block.timestamp + INTERVAL);

        uint256 payerBalanceBefore = usdc.balanceOf(payer);
        uint256 merchantBalanceBefore = usdc.balanceOf(merchant);
        uint256 feesBefore = manager.accumulatedFees();

        manager.charge(policyId);

        uint256 protocolFee = (CHARGE_AMOUNT * manager.PROTOCOL_FEE_BPS()) / manager.BPS_DENOMINATOR();
        uint256 merchantAmount = CHARGE_AMOUNT - protocolFee;

        assertEq(usdc.balanceOf(payer), payerBalanceBefore - CHARGE_AMOUNT);
        assertEq(usdc.balanceOf(merchant), merchantBalanceBefore + merchantAmount);
        assertEq(manager.accumulatedFees(), feesBefore + protocolFee);

        (,,,, uint128 totalSpent,, uint32 lastCharged, uint32 chargeCount,,,,) = manager.policies(policyId);
        assertEq(totalSpent, CHARGE_AMOUNT * 2); // First + second charge
        assertEq(lastCharged, block.timestamp);
        assertEq(chargeCount, 2);
    }

    function test_Charge_RevertPolicyNotActive() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        manager.revokePolicy(policyId);
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSignature("PolicyNotActive()"));
        manager.charge(policyId);
    }

    function test_Charge_RevertTooSoonToCharge() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        // First charge already happened on create, immediate second charge should fail
        vm.expectRevert(abi.encodeWithSignature("TooSoonToCharge()"));
        manager.charge(policyId);
    }

    function test_Charge_SuccessAfterInterval() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        // First charge already happened on create
        (,,,, uint128 totalSpentBefore,,, uint32 chargeCountBefore,,,,) = manager.policies(policyId);
        assertEq(totalSpentBefore, CHARGE_AMOUNT);
        assertEq(chargeCountBefore, 1);

        // skip ahead
        vm.warp(block.timestamp + INTERVAL);

        // Second charge should work
        manager.charge(policyId);

        (,,,, uint128 totalSpent,,, uint32 chargeCount,,,,) = manager.policies(policyId);
        assertEq(totalSpent, CHARGE_AMOUNT * 2);
        assertEq(chargeCount, 2);
    }

    function test_Charge_RevertSpendingCapExceeded() public {
        uint128 smallCap = 15e6; // 15 USDC cap, 10 USDC per charge

        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        // First charge (10 USDC) happens on create
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, smallCap, "");
        vm.stopPrank();

        vm.warp(block.timestamp + INTERVAL);

        // 10 (from create) + 10 = 20 > 15 cap
        vm.expectRevert(abi.encodeWithSignature("SpendingCapExceeded()"));
        manager.charge(policyId);
    }

    function test_Charge_SoftFailInsufficientAllowance() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), CHARGE_AMOUNT); // Only approve enough for first charge
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        vm.warp(block.timestamp + INTERVAL);

        // No allowance remaining - should soft-fail (return false), not revert
        bool success = manager.charge(policyId);
        assertFalse(success);

        (,,,,,,, , uint8 consecutiveFailures,,,) = manager.policies(policyId);
        assertEq(consecutiveFailures, 1);
    }

    function test_Charge_SoftFailInsufficientBalance() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");

        // Drain payer's remaining balance
        usdc.transfer(merchant, usdc.balanceOf(payer));
        vm.stopPrank();

        vm.warp(block.timestamp + INTERVAL);

        // Should soft-fail (return false), not revert
        bool success = manager.charge(policyId);
        assertFalse(success);

        (,,,,,,, , uint8 consecutiveFailures,,,) = manager.policies(policyId);
        assertEq(consecutiveFailures, 1);
    }

    // --- View Functions ---

    function test_CanCharge_ReturnsTrue() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        // First charge happened on create, need to wait for interval
        vm.warp(block.timestamp + INTERVAL);

        (bool canChargeResult, string memory reason) = manager.canCharge(policyId);
        assertTrue(canChargeResult);
        assertEq(reason, "");
    }

    function test_CanCharge_ReturnsFalse_TooSoon() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        // First charge just happened, should return false
        (bool canChargeResult, string memory reason) = manager.canCharge(policyId);
        assertFalse(canChargeResult);
        assertEq(reason, "Too soon to charge");
    }

    function test_CanCharge_ReturnsFalse_NotActive() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        manager.revokePolicy(policyId);
        vm.stopPrank();

        (bool canChargeResult, string memory reason) = manager.canCharge(policyId);
        assertFalse(canChargeResult);
        assertEq(reason, "Policy not active");
    }

    // --- Admin ---

    function test_WithdrawFees_Success() public {
        // First charge happens on createPolicy, accumulating fees
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        uint256 fees = manager.accumulatedFees();
        assertTrue(fees > 0);

        uint256 recipientBalanceBefore = usdc.balanceOf(feeRecipient);

        manager.withdrawFees();

        assertEq(usdc.balanceOf(feeRecipient), recipientBalanceBefore + fees);
        assertEq(manager.accumulatedFees(), 0);
    }

    function test_WithdrawFees_RevertNothingToWithdraw() public {
        vm.expectRevert(abi.encodeWithSignature("NothingToWithdraw()"));
        manager.withdrawFees();
    }

    function test_SetFeeRecipient() public {
        address newRecipient = makeAddr("newRecipient");
        manager.setFeeRecipient(newRecipient);
        assertEq(manager.feeRecipient(), newRecipient);
    }

    function test_SetFeeRecipient_RevertNotOwner() public {
        address newRecipient = makeAddr("newRecipient");

        vm.prank(payer);
        vm.expectRevert();
        manager.setFeeRecipient(newRecipient);
    }

    // --- Consecutive Failure Tracking ---

    function test_Charge_SoftFailure_IncrementsCounter() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), CHARGE_AMOUNT); // Only enough for first charge
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        // Fail 3 times across intervals
        for (uint8 i = 1; i <= 3; i++) {
            vm.warp(block.timestamp + INTERVAL);
            bool success = manager.charge(policyId);
            assertFalse(success);

            (,,,,,,,, uint8 failures,,,) = manager.policies(policyId);
            assertEq(failures, i);
        }
    }

    function test_Charge_ResetsCounterOnSuccess() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), CHARGE_AMOUNT); // Only enough for first charge
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        // Soft-fail once (no allowance remaining)
        vm.warp(block.timestamp + INTERVAL);
        bool success = manager.charge(policyId);
        assertFalse(success);

        (,,,,,,,, uint8 failuresAfterFail,,,) = manager.policies(policyId);
        assertEq(failuresAfterFail, 1);

        // Re-approve and charge successfully
        vm.prank(payer);
        usdc.approve(address(manager), type(uint256).max);

        vm.warp(block.timestamp + INTERVAL);
        success = manager.charge(policyId);
        assertTrue(success);

        (,,,,,,,, uint8 failuresAfterSuccess,,,) = manager.policies(policyId);
        assertEq(failuresAfterSuccess, 0);
    }

    function test_Charge_SoftFailure_UpdatesLastCharged() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), CHARGE_AMOUNT); // Only enough for first charge
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        uint256 chargeTime = block.timestamp + INTERVAL;
        vm.warp(chargeTime);
        manager.charge(policyId);

        (,,,,,, uint32 lastCharged,,,,, ) = manager.policies(policyId);
        assertEq(lastCharged, chargeTime); // lastCharged updated even on failure
    }

    function test_CancelFailedPolicy_Success() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), CHARGE_AMOUNT); // Only enough for first charge
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        // Accumulate 3 consecutive failures
        for (uint8 i = 0; i < 3; i++) {
            vm.warp(block.timestamp + INTERVAL);
            manager.charge(policyId);
        }

        // Anyone can cancel
        manager.cancelFailedPolicy(policyId);

        (,,,,,,,,, uint32 endTime, bool active,) = manager.policies(policyId);
        assertFalse(active);
        assertEq(endTime, block.timestamp);
    }

    function test_CancelFailedPolicy_AnyoneCanCall() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), CHARGE_AMOUNT);
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        for (uint8 i = 0; i < 3; i++) {
            vm.warp(block.timestamp + INTERVAL);
            manager.charge(policyId);
        }

        // Third party (not payer or merchant) can cancel
        address thirdParty = makeAddr("thirdParty");
        vm.prank(thirdParty);
        manager.cancelFailedPolicy(policyId);

        (,,,,,,,,, uint32 endTime, bool active,) = manager.policies(policyId);
        assertFalse(active);
        assertTrue(endTime > 0);
    }

    function test_CancelFailedPolicy_RevertNotFailedEnough() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), CHARGE_AMOUNT);
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        // 0 failures
        vm.expectRevert(abi.encodeWithSignature("PolicyNotFailedEnough()"));
        manager.cancelFailedPolicy(policyId);

        // 1 failure
        vm.warp(block.timestamp + INTERVAL);
        manager.charge(policyId);
        vm.expectRevert(abi.encodeWithSignature("PolicyNotFailedEnough()"));
        manager.cancelFailedPolicy(policyId);

        // 2 failures
        vm.warp(block.timestamp + INTERVAL);
        manager.charge(policyId);
        vm.expectRevert(abi.encodeWithSignature("PolicyNotFailedEnough()"));
        manager.cancelFailedPolicy(policyId);
    }

    function test_CancelFailedPolicy_RevertAlreadyInactive() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        manager.revokePolicy(policyId);
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSignature("PolicyNotActive()"));
        manager.cancelFailedPolicy(policyId);
    }

    function test_CanCharge_FalseAtMaxFailures() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), CHARGE_AMOUNT);
        bytes32 policyId = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        // Accumulate 3 consecutive failures
        for (uint8 i = 0; i < 3; i++) {
            vm.warp(block.timestamp + INTERVAL);
            manager.charge(policyId);
        }

        vm.warp(block.timestamp + INTERVAL);
        (bool canChargeResult, string memory reason) = manager.canCharge(policyId);
        assertFalse(canChargeResult);
        assertEq(reason, "Max consecutive failures reached");
    }

    function test_BatchCharge_WithSoftFailures() public {
        // Create two policies: one with funds, one without
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        bytes32 policyId1 = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        address brokePayer = makeAddr("brokePayer");
        usdc.mint(brokePayer, CHARGE_AMOUNT); // Only enough for first charge
        vm.startPrank(brokePayer);
        usdc.approve(address(manager), type(uint256).max);
        bytes32 policyId2 = manager.createPolicy(merchant, CHARGE_AMOUNT, INTERVAL, SPENDING_CAP, "");
        vm.stopPrank();

        // Drain brokePayer
        vm.prank(brokePayer);
        usdc.transfer(merchant, usdc.balanceOf(brokePayer));

        vm.warp(block.timestamp + INTERVAL);

        bytes32[] memory policyIds = new bytes32[](2);
        policyIds[0] = policyId1;
        policyIds[1] = policyId2;

        bool[] memory results = manager.batchCharge(policyIds);
        assertTrue(results[0]);  // payer has funds
        assertFalse(results[1]); // brokePayer is drained
    }
}
