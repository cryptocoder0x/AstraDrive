// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IAsterEarn.sol";
import "./interfaces/IPancakeRouter.sol";
import "./interfaces/IPancakePair.sol";
import "./libraries/VaultMath.sol";
import "./libraries/VolatilityLib.sol";

/// @title StrategyRouter
/// @notice Routes capital between AsterDEX Earn and PancakeSwap LP based on on-chain volatility.
/// @dev No admin keys. Callable only by EngineCore (immutable reference).
///      Allocation is determined deterministically by VolatilityLib market mode.
contract StrategyRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using VolatilityLib for uint256;

    // ─── Immutables ──────────────────────────────────────────────────────────
    /// @notice The BUSD token on BNB Chain Testnet
    address public constant BUSD = 0xC57BFAf8FB2BE3DC1dcd49dC53ED37951C587596;

    IAsterEarn public immutable asterEarn;
    IPancakeRouter02 public immutable pancakeRouter;
    IPancakePair public immutable lpPair;
    IERC20 public immutable tokenA;   // primary token (e.g., BUSD)
    IERC20 public immutable tokenB;   // paired token (e.g., WBNB)
    address public immutable engineCore;

    // ─── Constants ───────────────────────────────────────────────────────────
    uint256 public constant SLIPPAGE_BPS = 50;        // 0.5% slippage tolerance
    uint256 public constant DRIFT_THRESHOLD_BPS = 200; // 2% drift triggers rebalance

    // ─── State ───────────────────────────────────────────────────────────────
    uint256 public lastPriceSnapshot;
    uint256 public lastSnapshotTime;
    VolatilityLib.MarketMode public currentMode;
    uint256 public asterAllocationBps;
    uint256 public lpAllocationBps;

    // ─── Events ──────────────────────────────────────────────────────────────
    event Rebalanced(
        VolatilityLib.MarketMode mode,
        uint256 asterBps,
        uint256 lpBps,
        uint256 deviationBps,
        uint256 timestamp
    );
    event CapitalDeployedToAster(uint256 amount);
    event CapitalDeployedToLP(uint256 amountA, uint256 amountB, uint256 liquidity);
    event LPWithdrawn(uint256 liquidity, uint256 amountA, uint256 amountB);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(
        address _asterEarn,
        address _pancakeRouter,
        address _lpPair,
        address _tokenB,
        address _engineCore
    ) {
        require(_asterEarn != address(0), "SR: zero aster");
        require(_pancakeRouter != address(0), "SR: zero router");
        require(_lpPair != address(0), "SR: zero pair");
        require(_tokenB != address(0), "SR: zero tokenB");
        require(_engineCore != address(0), "SR: zero engine");

        asterEarn = IAsterEarn(_asterEarn);
        pancakeRouter = IPancakeRouter02(_pancakeRouter);
        lpPair = IPancakePair(_lpPair);
        tokenA = IERC20(BUSD);
        tokenB = IERC20(_tokenB);
        engineCore = _engineCore;

        // Initialize with NORMAL mode
        currentMode = VolatilityLib.MarketMode.NORMAL;
        asterAllocationBps = VolatilityLib.NORMAL_ASTER_BPS;
        lpAllocationBps = 10_000 - VolatilityLib.NORMAL_ASTER_BPS;

        // Take initial price snapshot
        lastPriceSnapshot = VolatilityLib.getSpotPrice(address(_lpPair));
        lastSnapshotTime = block.timestamp;
    }

    modifier onlyEngine() {
        require(msg.sender == engineCore, "SR: only engine");
        _;
    }

    // ─── Core Logic ──────────────────────────────────────────────────────────

    /// @notice Evaluate on-chain volatility and rebalance if needed
    /// @dev Called by EngineCore.executeCycle(). Fully deterministic.
    function rebalance() external onlyEngine nonReentrant {
        uint256 currentPrice = VolatilityLib.getSpotPrice(address(lpPair));
        uint256 deviationBps = VolatilityLib.priceDeviation(currentPrice, lastPriceSnapshot);

        VolatilityLib.MarketMode newMode = VolatilityLib.getMarketMode(deviationBps);
        uint256 targetAsterBps = VolatilityLib.getAsterAllocation(newMode);

        bool modeChanged = newMode != currentMode;
        bool driftExceeded = VolatilityLib.isRebalanceNeeded(
            asterAllocationBps,
            targetAsterBps,
            DRIFT_THRESHOLD_BPS
        );

        if (modeChanged || driftExceeded) {
            _executeRebalance(targetAsterBps, newMode);
        }

        // Update price snapshot
        lastPriceSnapshot = currentPrice;
        lastSnapshotTime = block.timestamp;

        emit Rebalanced(newMode, asterAllocationBps, lpAllocationBps, deviationBps, block.timestamp);
    }

    /// @notice Deploy fresh capital into the strategy according to current allocation
    /// @param totalCapital Total capital to deploy (in tokenA units)
    function deployCapital(uint256 totalCapital) external onlyEngine nonReentrant {
        if (totalCapital == 0) return;

        (uint256 asterAmount, uint256 lpAmount) = VaultMath.calcAllocation(
            totalCapital,
            asterAllocationBps
        );

        // Deploy to AsterEarn
        if (asterAmount > 0) {
            tokenA.forceApprove(address(asterEarn), asterAmount);
            asterEarn.deposit(asterAmount);
            emit CapitalDeployedToAster(asterAmount);
        }

        // Deploy to PancakeSwap LP
        if (lpAmount > 0 && currentMode != VolatilityLib.MarketMode.DRAWDOWN) {
            _addLiquidity(lpAmount);
        }
    }

    /// @notice Withdraw all LP positions (called in DRAWDOWN mode)
    function withdrawLP() external onlyEngine nonReentrant {
        uint256 lpBalance = lpPair.balanceOf(address(this));
        if (lpBalance == 0) return;
        _removeLiquidity(lpBalance);
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _executeRebalance(uint256 targetAsterBps, VolatilityLib.MarketMode newMode) internal {
        // If moving to DRAWDOWN: pull all LP
        if (newMode == VolatilityLib.MarketMode.DRAWDOWN) {
            uint256 lpBalance = lpPair.balanceOf(address(this));
            if (lpBalance > 0) {
                _removeLiquidity(lpBalance);
                // Re-deploy freed capital into Aster
                uint256 freed = tokenA.balanceOf(address(this));
                if (freed > 0) {
                    tokenA.forceApprove(address(asterEarn), freed);
                    asterEarn.deposit(freed);
                }
            }
        }

        currentMode = newMode;
        asterAllocationBps = targetAsterBps;
        lpAllocationBps = 10_000 - targetAsterBps;
    }

    function _addLiquidity(uint256 amountA) internal {
        // Swap half of amountA to tokenB
        uint256 halfA = amountA / 2;
        uint256 otherHalf = amountA - halfA;

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        uint256[] memory amountsOut = pancakeRouter.getAmountsOut(halfA, path);
        uint256 expectedB = amountsOut[1];
        uint256 minB = VaultMath.applySlippage(expectedB, SLIPPAGE_BPS);

        tokenA.forceApprove(address(pancakeRouter), halfA);
        uint256[] memory swapped = pancakeRouter.swapExactTokensForTokens(
            halfA,
            minB,
            path,
            address(this),
            block.timestamp + 300
        );
        uint256 receivedB = swapped[1];

        // Add liquidity
        tokenA.forceApprove(address(pancakeRouter), otherHalf);
        tokenB.forceApprove(address(pancakeRouter), receivedB);

        uint256 minA = VaultMath.applySlippage(otherHalf, SLIPPAGE_BPS);
        uint256 minBLiq = VaultMath.applySlippage(receivedB, SLIPPAGE_BPS);

        (uint256 usedA, uint256 usedB, uint256 liquidity) = pancakeRouter.addLiquidity(
            address(tokenA),
            address(tokenB),
            otherHalf,
            receivedB,
            minA,
            minBLiq,
            address(this),
            block.timestamp + 300
        );

        emit CapitalDeployedToLP(usedA, usedB, liquidity);
    }

    function _removeLiquidity(uint256 liquidity) internal {
        lpPair.approve(address(pancakeRouter), liquidity);

        uint256 minA = 0; // slippage handled by caller context
        uint256 minB = 0;

        (uint256 amountA, uint256 amountB) = pancakeRouter.removeLiquidity(
            address(tokenA),
            address(tokenB),
            liquidity,
            minA,
            minB,
            address(this),
            block.timestamp + 300
        );

        emit LPWithdrawn(liquidity, amountA, amountB);
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    /// @notice Total assets managed: Aster position + LP position value
    function totalManagedAssets() external view returns (uint256) {
        uint256 asterAssets = asterEarn.totalAssets();
        uint256 lpValue = _lpValueInTokenA();
        return asterAssets + lpValue;
    }

    function _lpValueInTokenA() internal view returns (uint256) {
        uint256 lpBalance = lpPair.balanceOf(address(this));
        if (lpBalance == 0) return 0;
        uint256 lpSupply = lpPair.totalSupply();
        if (lpSupply == 0) return 0;
        (uint112 reserve0, , ) = lpPair.getReserves();
        // Approximate: 2 * tokenA reserve * (lpBalance / lpSupply)
        return (2 * uint256(reserve0) * lpBalance) / lpSupply;
    }

    /// @notice Current on-chain risk score (0–100)
    function riskScore() external view returns (uint256) {
        uint256 currentPrice = VolatilityLib.getSpotPrice(address(lpPair));
        uint256 deviation = VolatilityLib.priceDeviation(currentPrice, lastPriceSnapshot);
        return VolatilityLib.riskScore(deviation);
    }
}
