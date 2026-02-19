// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IAsterEarn.sol";
import "./interfaces/IPancakeRouter.sol";
import "./interfaces/IPancakePair.sol";
import "./libraries/VaultMath.sol";

/// @title AutoCompounder
/// @notice Harvests rewards from AsterEarn, swaps to LP tokens, adds liquidity, compounds.
/// @dev No admin keys. Callable only by EngineCore (immutable reference).
///      All operations are atomic. No human trigger required.
contract AutoCompounder is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Immutables ──────────────────────────────────────────────────────────
    /// @notice The BUSD token on BNB Chain Testnet
    address public constant BUSD = 0xC57BFAf8FB2BE3DC1dcd49dC53ED37951C587596;

    IAsterEarn public immutable asterEarn;
    IPancakeRouter02 public immutable pancakeRouter;
    IPancakePair public immutable lpPair;
    IERC20 public immutable rewardToken;  // token received from AsterEarn rewards
    IERC20 public immutable tokenA;       // primary vault token
    IERC20 public immutable tokenB;       // paired LP token
    address public immutable engineCore;
    address public immutable vault;       // AstraVault address

    // ─── Constants ───────────────────────────────────────────────────────────
    uint256 public constant SLIPPAGE_BPS = 100; // 1% slippage for reward swaps

    // ─── State ───────────────────────────────────────────────────────────────
    uint256 public lastCompoundTime;
    uint256 public totalCompounded;
    uint256 public totalRewardsHarvested;

    // ─── Events ──────────────────────────────────────────────────────────────
    event Compounded(
        uint256 rewardsHarvested,
        uint256 lpMinted,
        uint256 asterDeposited,
        uint256 timestamp
    );
    event RewardsClaimed(uint256 amount, uint256 timestamp);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(
        address _asterEarn,
        address _pancakeRouter,
        address _lpPair,
        address _tokenB,
        address _engineCore,
        address _vault
    ) {
        require(_asterEarn != address(0), "AC: zero aster");
        require(_pancakeRouter != address(0), "AC: zero router");
        require(_lpPair != address(0), "AC: zero pair");
        require(_tokenB != address(0), "AC: zero tokenB");
        require(_engineCore != address(0), "AC: zero engine");
        require(_vault != address(0), "AC: zero vault");

        asterEarn = IAsterEarn(_asterEarn);
        pancakeRouter = IPancakeRouter02(_pancakeRouter);
        lpPair = IPancakePair(_lpPair);
        rewardToken = IERC20(BUSD);
        tokenA = IERC20(BUSD);
        tokenB = IERC20(_tokenB);
        engineCore = _engineCore;
        vault = _vault;
        lastCompoundTime = block.timestamp;
    }

    modifier onlyEngine() {
        require(msg.sender == engineCore, "AC: only engine");
        _;
    }

    // ─── Core Logic ──────────────────────────────────────────────────────────

    /// @notice Harvest rewards from AsterEarn, compound into LP + Aster positions
    /// @dev Called by EngineCore.executeCycle(). Fully autonomous.
    function compound() external onlyEngine nonReentrant {
        // 1. Claim rewards from AsterEarn
        uint256 rewardsBefore = rewardToken.balanceOf(address(this));
        asterEarn.claimRewards();
        uint256 rewardsAfter = rewardToken.balanceOf(address(this));
        uint256 harvested = rewardsAfter - rewardsBefore;

        if (harvested == 0) {
            emit Compounded(0, 0, 0, block.timestamp);
            return;
        }

        totalRewardsHarvested += harvested;
        emit RewardsClaimed(harvested, block.timestamp);

        // 2. Convert rewards to tokenA if needed
        uint256 tokenAAmount = _convertRewardsToTokenA(harvested);

        // 3. Split: 50% to LP, 50% back to Aster (compound into both strategies)
        uint256 halfForLP = tokenAAmount / 2;
        uint256 halfForAster = tokenAAmount - halfForLP;

        // 4. Add liquidity with half
        uint256 lpMinted = 0;
        if (halfForLP > 0) {
            lpMinted = _addLiquidityFromTokenA(halfForLP);
        }

        // 5. Re-deposit other half into AsterEarn
        uint256 asterDeposited = 0;
        if (halfForAster > 0) {
            tokenA.forceApprove(address(asterEarn), halfForAster);
            asterEarn.deposit(halfForAster);
            asterDeposited = halfForAster;
        }

        totalCompounded += tokenAAmount;
        lastCompoundTime = block.timestamp;

        emit Compounded(harvested, lpMinted, asterDeposited, block.timestamp);
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _convertRewardsToTokenA(uint256 rewardAmount) internal returns (uint256 tokenAOut) {
        // If reward token IS tokenA, no swap needed
        if (address(rewardToken) == address(tokenA)) {
            return rewardAmount;
        }

        address[] memory path = new address[](2);
        path[0] = address(rewardToken);
        path[1] = address(tokenA);

        uint256[] memory amountsOut = pancakeRouter.getAmountsOut(rewardAmount, path);
        uint256 expectedOut = amountsOut[1];
        uint256 minOut = VaultMath.applySlippage(expectedOut, SLIPPAGE_BPS);

        rewardToken.forceApprove(address(pancakeRouter), rewardAmount);
        uint256[] memory swapped = pancakeRouter.swapExactTokensForTokens(
            rewardAmount,
            minOut,
            path,
            address(this),
            block.timestamp + 300
        );
        return swapped[1];
    }

    function _addLiquidityFromTokenA(uint256 amountA) internal returns (uint256 liquidity) {
        uint256 halfA = amountA / 2;
        uint256 otherHalf = amountA - halfA;

        // Swap half to tokenB
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

        (, , liquidity) = pancakeRouter.addLiquidity(
            address(tokenA),
            address(tokenB),
            otherHalf,
            receivedB,
            minA,
            minBLiq,
            address(this),
            block.timestamp + 300
        );
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    /// @notice Time since last compound in seconds
    function timeSinceLastCompound() external view returns (uint256) {
        return block.timestamp - lastCompoundTime;
    }
}
