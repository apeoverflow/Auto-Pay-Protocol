// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mintable test USDC for testnet deployments
contract TestUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Deploy a mintable test USDC and mint initial supply to deployer.
///         Use this only on testnets where no official USDC exists.
///         Usage: PRIVATE_KEY=0x... MINT_AMOUNT=1000000000000 forge script script/DeployTestUSDC.s.sol --rpc-url <testnet-rpc> --broadcast
contract DeployTestUSDC is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        uint256 mintAmount = vm.envOr("MINT_AMOUNT", uint256(1_000_000e6)); // default 1M USDC
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        TestUSDC usdc = new TestUSDC();
        usdc.mint(deployer, mintAmount);

        vm.stopBroadcast();

        console.log("TEST_USDC:", address(usdc));
        console.log("MINTED:", mintAmount);
        console.log("TO:", deployer);
    }
}
