// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PolicyManager} from "../src/PolicyManager.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        PolicyManager manager = new PolicyManager(usdc, feeRecipient);

        vm.stopBroadcast();

        // output for parsing
        console.log("CHAIN_ID:", block.chainid);
        console.log("POLICY_MANAGER:", address(manager));
        console.log("USDC:", usdc);
        console.log("FEE_RECIPIENT:", feeRecipient);
        console.log("DEPLOYER:", vm.addr(deployerPrivateKey));
    }
}
