// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IAsterEarn
/// @notice Interface for AsterDEX Earn vault – the primary yield primitive
interface IAsterEarn {
    /// @notice Deposit `amount` of underlying tokens into AsterEarn
    function deposit(uint256 amount) external;

    /// @notice Withdraw by burning `shares` from AsterEarn
    function withdraw(uint256 shares) external;

    /// @notice Claim pending rewards from AsterEarn
    function claimRewards() external;

    /// @notice Total underlying assets held by AsterEarn
    function totalAssets() external view returns (uint256);

    /// @notice Total shares issued by AsterEarn
    function totalShares() external view returns (uint256);
}
