// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IAutoCompounder
/// @notice Interface for the AstraDrive auto-compounding layer
interface IAutoCompounder {
    function compound() external;
    function lastCompoundTime() external view returns (uint256);
    function totalCompounded() external view returns (uint256);
}
