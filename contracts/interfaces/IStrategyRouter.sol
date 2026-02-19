// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IStrategyRouter
/// @notice Interface for the AstraDrive strategy routing layer
interface IStrategyRouter {
    enum MarketMode { NORMAL, HIGH_VOLATILITY, DRAWDOWN }

    function rebalance() external;
    function currentMode() external view returns (MarketMode);
    function asterAllocation() external view returns (uint256); // basis points
    function lpAllocation() external view returns (uint256);    // basis points
    function totalManagedAssets() external view returns (uint256);
}
