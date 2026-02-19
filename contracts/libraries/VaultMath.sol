// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title VaultMath
/// @notice Pure math library for share price, fee, and capital efficiency calculations
library VaultMath {
    uint256 internal constant PRECISION = 1e18;
    uint256 internal constant BASIS_POINTS = 10_000;

    /// @notice Calculate shares to mint for a given asset deposit
    /// @param assets Amount of assets being deposited
    /// @param totalAssets Current total assets in vault
    /// @param totalShares Current total shares outstanding
    /// @return shares Amount of shares to mint
    function assetsToShares(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    ) internal pure returns (uint256 shares) {
        if (totalShares == 0 || totalAssets == 0) {
            // Initial deposit: 1:1 ratio with 1e18 precision
            return assets;
        }
        return (assets * totalShares) / totalAssets;
    }

    /// @notice Calculate assets to return for a given share redemption
    /// @param shares Amount of shares being redeemed
    /// @param totalAssets Current total assets in vault
    /// @param totalShares Current total shares outstanding
    /// @return assets Amount of assets to return
    function sharesToAssets(
        uint256 shares,
        uint256 totalAssets,
        uint256 totalShares
    ) internal pure returns (uint256 assets) {
        if (totalShares == 0) return 0;
        return (shares * totalAssets) / totalShares;
    }

    /// @notice Calculate current share price (assets per share) scaled by PRECISION
    /// @param totalAssets Total assets under management
    /// @param totalShares Total shares outstanding
    /// @return price Share price scaled by 1e18
    function sharePrice(
        uint256 totalAssets,
        uint256 totalShares
    ) internal pure returns (uint256 price) {
        if (totalShares == 0) return PRECISION;
        return (totalAssets * PRECISION) / totalShares;
    }

    /// @notice Calculate performance fee in shares to mint to vault (auto-compounded)
    /// @param profit New profit earned since last harvest
    /// @param feeBps Fee in basis points (e.g., 1000 = 10%)
    /// @param totalAssets Total assets before fee
    /// @param totalShares Total shares before fee
    /// @return feeShares Shares to mint representing the fee
    function calcPerformanceFeeShares(
        uint256 profit,
        uint256 feeBps,
        uint256 totalAssets,
        uint256 totalShares
    ) internal pure returns (uint256 feeShares) {
        if (profit == 0 || feeBps == 0) return 0;
        uint256 feeAssets = (profit * feeBps) / BASIS_POINTS;
        // Mint shares at current price so existing holders are diluted proportionally
        return assetsToShares(feeAssets, totalAssets, totalShares);
    }

    /// @notice Calculate target allocation amounts given total capital and basis points
    /// @param totalCapital Total capital to allocate
    /// @param asterBps Aster allocation in basis points
    /// @return asterAmount Amount for Aster
    /// @return lpAmount Amount for LP
    function calcAllocation(
        uint256 totalCapital,
        uint256 asterBps
    ) internal pure returns (uint256 asterAmount, uint256 lpAmount) {
        asterAmount = (totalCapital * asterBps) / BASIS_POINTS;
        lpAmount = totalCapital - asterAmount;
    }

    /// @notice Calculate slippage-adjusted minimum output
    /// @param amount Expected output amount
    /// @param slippageBps Slippage tolerance in basis points (e.g., 50 = 0.5%)
    /// @return minAmount Minimum acceptable output
    function applySlippage(
        uint256 amount,
        uint256 slippageBps
    ) internal pure returns (uint256 minAmount) {
        return (amount * (BASIS_POINTS - slippageBps)) / BASIS_POINTS;
    }

    /// @notice Compute APY from yield earned over a time period
    /// @param yieldEarned Yield earned in the period
    /// @param principal Starting principal
    /// @param periodSeconds Duration in seconds
    /// @return apyBps APY in basis points (annualized)
    function computeAPY(
        uint256 yieldEarned,
        uint256 principal,
        uint256 periodSeconds
    ) internal pure returns (uint256 apyBps) {
        if (principal == 0 || periodSeconds == 0) return 0;
        uint256 YEAR = 365 days;
        // APY = (yield / principal) * (YEAR / period) * BASIS_POINTS
        return (yieldEarned * YEAR * BASIS_POINTS) / (principal * periodSeconds);
    }
}
