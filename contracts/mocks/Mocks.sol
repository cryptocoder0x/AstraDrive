// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol, uint256 supply) ERC20(name, symbol) {
        _mint(msg.sender, supply);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockPancakePair {
    uint112 public reserve0 = 1_000_000e18;
    uint112 public reserve1 = 1_000_000e18;
    uint32 public blockTimestampLast;
    uint256 public totalSupply = 1_000_000e18;
    mapping(address => uint256) public balanceOf;

    function setReserves(uint112 r0, uint112 r1) external {
        reserve0 = r0;
        reserve1 = r1;
    }

    function getReserves() external view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, blockTimestampLast);
    }

    function token0() external pure returns (address) { return address(0); }
    function token1() external pure returns (address) { return address(0); }
    function approve(address, uint256) external pure returns (bool) { return true; }
    function transfer(address, uint256) external pure returns (bool) { return true; }
    function price0CumulativeLast() external pure returns (uint256) { return 0; }
    function price1CumulativeLast() external pure returns (uint256) { return 0; }
}

contract MockVaultForEngine {
    uint256 public lastRecordedAssets;

    function recordHarvest(uint256 newTotalAssets) external {
        lastRecordedAssets = newTotalAssets;
    }
}

contract MockStrategyRouter {
    bool public rebalanceCalled;

    function rebalance() external {
        rebalanceCalled = true;
    }
}

contract MockAutoCompounder {
    bool public compoundCalled;

    function compound() external {
        compoundCalled = true;
    }
}
