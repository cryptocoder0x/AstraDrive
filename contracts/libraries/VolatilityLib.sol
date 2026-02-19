// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IPancakePair.sol";

/// @title VolatilityLib
/// @notice On-chain volatility detection using LP reserve price deltas
/// @dev Computes a risk score and market mode deterministically from on-chain data
library VolatilityLib {
    uint256 internal constant PRECISION = 1e18;
    uint256 internal constant BASIS_POINTS = 10_000;

    /// @notice Market mode enum
    enum MarketMode {
        NORMAL,         // price deviation < LOW_THRESHOLD
        HIGH_VOLATILITY, // price deviation >= LOW_THRESHOLD
        DRAWDOWN        // price deviation >= HIGH_THRESHOLD (severe)
    }

    /// @notice Thresholds for mode switching (in basis points of price deviation)
    uint256 internal constant LOW_THRESHOLD = 300;   // 3% deviation → HIGH_VOLATILITY
    uint256 internal constant HIGH_THRESHOLD = 800;  // 8% deviation → DRAWDOWN

    /// @notice Allocation basis points per mode
    uint256 internal constant NORMAL_ASTER_BPS = 7000;       // 70%
    uint256 internal constant HIGHVOL_ASTER_BPS = 8500;      // 85%
    uint256 internal constant DRAWDOWN_ASTER_BPS = 10000;    // 100%

    /// @notice Compute the spot price of token0 in terms of token1 from LP reserves
    /// @param pair PancakeSwap pair address
    /// @return price Spot price scaled by PRECISION (token1 per token0)
    function getSpotPrice(address pair) internal view returns (uint256 price) {
        (uint112 reserve0, uint112 reserve1, ) = IPancakePair(pair).getReserves();
        if (reserve0 == 0) return 0;
        return (uint256(reserve1) * PRECISION) / uint256(reserve0);
    }

    /// @notice Compute price deviation between two price snapshots in basis points
    /// @param priceNow Current price (scaled by PRECISION)
    /// @param priceBefore Previous price (scaled by PRECISION)
    /// @return deviationBps Absolute deviation in basis points
    function priceDeviation(
        uint256 priceNow,
        uint256 priceBefore
    ) internal pure returns (uint256 deviationBps) {
        if (priceBefore == 0) return 0;
        uint256 delta = priceNow > priceBefore
            ? priceNow - priceBefore
            : priceBefore - priceNow;
        return (delta * BASIS_POINTS) / priceBefore;
    }

    /// @notice Determine market mode from price deviation
    /// @param deviationBps Price deviation in basis points
    /// @return mode Current MarketMode
    function getMarketMode(uint256 deviationBps) internal pure returns (MarketMode mode) {
        if (deviationBps >= HIGH_THRESHOLD) return MarketMode.DRAWDOWN;
        if (deviationBps >= LOW_THRESHOLD) return MarketMode.HIGH_VOLATILITY;
        return MarketMode.NORMAL;
    }

    /// @notice Get Aster allocation basis points for a given market mode
    /// @param mode Current MarketMode
    /// @return asterBps Aster allocation in basis points
    function getAsterAllocation(MarketMode mode) internal pure returns (uint256 asterBps) {
        if (mode == MarketMode.DRAWDOWN) return DRAWDOWN_ASTER_BPS;
        if (mode == MarketMode.HIGH_VOLATILITY) return HIGHVOL_ASTER_BPS;
        return NORMAL_ASTER_BPS;
    }

    /// @notice Compute a 0–100 risk score from deviation
    /// @param deviationBps Price deviation in basis points
    /// @return score Risk score 0 (safe) to 100 (extreme)
    function riskScore(uint256 deviationBps) internal pure returns (uint256 score) {
        // Cap at 2000 bps (20%) for max score
        if (deviationBps >= 2000) return 100;
        return (deviationBps * 100) / 2000;
    }

    /// @notice Check if rebalance is needed based on current vs target allocation
    /// @param currentAsterBps Current Aster allocation in basis points
    /// @param targetAsterBps Target Aster allocation in basis points
    /// @param driftThresholdBps Acceptable drift before rebalance (e.g., 200 = 2%)
    /// @return needed True if rebalance should occur
    function isRebalanceNeeded(
        uint256 currentAsterBps,
        uint256 targetAsterBps,
        uint256 driftThresholdBps
    ) internal pure returns (bool needed) {
        uint256 drift = currentAsterBps > targetAsterBps
            ? currentAsterBps - targetAsterBps
            : targetAsterBps - currentAsterBps;
        return drift >= driftThresholdBps;
    }
}
