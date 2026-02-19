// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IAsterEarn.sol";
import "./libraries/VolatilityLib.sol";

/// @title EngineCore
/// @notice The autonomous orchestrator of the AstraDrive protocol.
/// @dev executeCycle() is callable by ANYONE. No privileged role. No owner.
///      No onlyOwner. No Pausable. No upgradeable proxy.
///      Automation is purely state-based and timestamp-driven.
///
///      Cycle logic:
///        1. Check cooldown (min interval between cycles)
///        2. Detect volatility via VolatilityLib
///        3. Trigger StrategyRouter.rebalance() if needed
///        4. Trigger AutoCompounder.compound() to harvest + reinvest
///        5. Record harvest in AstraVault for fee accounting
contract EngineCore is ReentrancyGuard {
    using VolatilityLib for uint256;

    // ─── Immutables ──────────────────────────────────────────────────────────
    address public immutable vault;
    address public immutable strategyRouter;
    address public immutable autoCompounder;
    address public immutable asterEarn;
    address public immutable lpPair;

    // ─── Constants ───────────────────────────────────────────────────────────
    /// @notice Minimum time between cycle executions (1 hour)
    uint256 public constant CYCLE_INTERVAL = 1 hours;

    /// @notice Caller incentive: 0.1% of yield goes to cycle executor (gas refund)
    uint256 public constant CALLER_INCENTIVE_BPS = 10;

    // ─── State ───────────────────────────────────────────────────────────────
    uint256 public lastCycleTime;
    uint256 public totalCyclesExecuted;
    uint256 public lastPriceSnapshot;
    VolatilityLib.MarketMode public lastMode;

    // ─── Events ──────────────────────────────────────────────────────────────
    event CycleExecuted(
        address indexed caller,
        VolatilityLib.MarketMode mode,
        uint256 riskScore,
        uint256 cycleNumber,
        uint256 timestamp
    );
    event RebalanceTriggered(VolatilityLib.MarketMode mode, uint256 deviationBps);
    event CompoundTriggered(uint256 timestamp);
    event CycleCooldown(uint256 nextCycleTime);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(
        address _vault,
        address _strategyRouter,
        address _autoCompounder,
        address _asterEarn,
        address _lpPair
    ) {
        require(_vault != address(0), "EC: zero vault");
        require(_strategyRouter != address(0), "EC: zero router");
        require(_autoCompounder != address(0), "EC: zero compounder");
        require(_asterEarn != address(0), "EC: zero aster");
        require(_lpPair != address(0), "EC: zero pair");

        vault = _vault;
        strategyRouter = _strategyRouter;
        autoCompounder = _autoCompounder;
        asterEarn = _asterEarn;
        lpPair = _lpPair;

        lastCycleTime = block.timestamp;
        lastPriceSnapshot = VolatilityLib.getSpotPrice(_lpPair);
        lastMode = VolatilityLib.MarketMode.NORMAL;
    }

    // ─── Core: executeCycle ──────────────────────────────────────────────────

    /// @notice Execute one autonomous protocol cycle.
    /// @dev Callable by ANYONE. No privileged role.
    ///      Enforces cooldown via block.timestamp.
    ///      Deterministic: outcome depends only on on-chain state.
    function executeCycle() external nonReentrant {
        // ── 1. Cooldown check ────────────────────────────────────────────────
        uint256 nextCycle = lastCycleTime + CYCLE_INTERVAL;
        if (block.timestamp < nextCycle) {
            emit CycleCooldown(nextCycle);
            revert("EC: cooldown active");
        }

        // ── 2. Compute on-chain volatility ───────────────────────────────────
        uint256 currentPrice = VolatilityLib.getSpotPrice(lpPair);
        uint256 deviationBps = VolatilityLib.priceDeviation(currentPrice, lastPriceSnapshot);
        VolatilityLib.MarketMode mode = VolatilityLib.getMarketMode(deviationBps);
        uint256 risk = VolatilityLib.riskScore(deviationBps);

        // ── 3. Rebalance if mode changed or drift exceeded ───────────────────
        bool shouldRebalance = (mode != lastMode) ||
            VolatilityLib.isRebalanceNeeded(
                _getAsterBps(lastMode),
                VolatilityLib.getAsterAllocation(mode),
                200 // 2% drift threshold
            );

        if (shouldRebalance) {
            // Call StrategyRouter.rebalance()
            (bool ok, ) = strategyRouter.call(abi.encodeWithSignature("rebalance()"));
            require(ok, "EC: rebalance failed");
            emit RebalanceTriggered(mode, deviationBps);
        }

        // ── 4. Compound: harvest rewards + reinvest ──────────────────────────
        (bool compOk, ) = autoCompounder.call(abi.encodeWithSignature("compound()"));
        require(compOk, "EC: compound failed");
        emit CompoundTriggered(block.timestamp);

        // ── 5. Record harvest in vault for fee accounting ────────────────────
        uint256 newTotalAssets = IAsterEarn(asterEarn).totalAssets();
        (bool harvestOk, ) = vault.call(
            abi.encodeWithSignature("recordHarvest(uint256)", newTotalAssets)
        );
        require(harvestOk, "EC: harvest record failed");

        // ── 6. Update state ──────────────────────────────────────────────────
        lastPriceSnapshot = currentPrice;
        lastMode = mode;
        lastCycleTime = block.timestamp;
        totalCyclesExecuted++;

        emit CycleExecuted(msg.sender, mode, risk, totalCyclesExecuted, block.timestamp);
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    /// @notice Check if a cycle can be executed right now
    function canExecuteCycle() external view returns (bool) {
        return block.timestamp >= lastCycleTime + CYCLE_INTERVAL;
    }

    /// @notice Seconds until next cycle is allowed
    function timeUntilNextCycle() external view returns (uint256) {
        uint256 nextCycle = lastCycleTime + CYCLE_INTERVAL;
        if (block.timestamp >= nextCycle) return 0;
        return nextCycle - block.timestamp;
    }

    /// @notice Current on-chain market mode
    function currentMarketMode() external view returns (VolatilityLib.MarketMode) {
        uint256 currentPrice = VolatilityLib.getSpotPrice(lpPair);
        uint256 deviationBps = VolatilityLib.priceDeviation(currentPrice, lastPriceSnapshot);
        return VolatilityLib.getMarketMode(deviationBps);
    }

    /// @notice Current on-chain risk score (0–100)
    function currentRiskScore() external view returns (uint256) {
        uint256 currentPrice = VolatilityLib.getSpotPrice(lpPair);
        uint256 deviationBps = VolatilityLib.priceDeviation(currentPrice, lastPriceSnapshot);
        return VolatilityLib.riskScore(deviationBps);
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _getAsterBps(VolatilityLib.MarketMode mode) internal pure returns (uint256) {
        return VolatilityLib.getAsterAllocation(mode);
    }
}
