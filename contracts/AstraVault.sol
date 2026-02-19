// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./libraries/VaultMath.sol";

/// @title AstraVault
/// @notice ERC4626-compliant autonomous yield vault. Issues ASTRA shares.
/// @dev No admin keys, no owner, no pause, no proxy. Fully immutable.
///      Performance fee is auto-compounded into the vault (increases share price for all holders).
contract AstraVault is ERC4626, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using VaultMath for uint256;

    // ─── Constants ───────────────────────────────────────────────────────────
    /// @notice Performance fee in basis points (10% of yield, auto-compounded)
    uint256 public constant PERFORMANCE_FEE_BPS = 1000;

    /// @notice Minimum deposit to prevent dust attacks
    uint256 public constant MIN_DEPOSIT = 1e6;

    // ─── Immutable Addresses ─────────────────────────────────────────────────
    /// @notice The BUSD token on BNB Chain Testnet
    address public constant BUSD = 0xC57BFAf8FB2BE3DC1dcd49dC53ED37951C587596;

    /// @notice The EngineCore contract – only caller allowed to trigger fee minting
    address public immutable engineCore;

    // ─── State ───────────────────────────────────────────────────────────────
    /// @notice Tracks total assets at last harvest for profit calculation
    uint256 public lastHarvestAssets;

    /// @notice Total yield harvested lifetime
    uint256 public totalYieldHarvested;

    /// @notice Timestamp of last harvest
    uint256 public lastHarvestTime;

    /// @notice Cumulative APY tracking (basis points, rolling)
    uint256 public currentAPYBps;

    // ─── Events ──────────────────────────────────────────────────────────────
    event FeeCompounded(uint256 profit, uint256 feeShares, uint256 timestamp);
    event APYUpdated(uint256 apyBps, uint256 timestamp);
    event HarvestRecorded(uint256 totalAssets, uint256 timestamp);

    // ─── Constructor ─────────────────────────────────────────────────────────
    /// @param _engineCore Address of the immutable EngineCore contract
    constructor(
        address _engineCore
    )
        ERC4626(IERC20(BUSD))
        ERC20("AstraDrive Vault Token", "ASTRA")
    {
        require(_engineCore != address(0), "AstraVault: zero engine");
        engineCore = _engineCore;
        lastHarvestTime = block.timestamp;
    }

    // ─── ERC4626 Overrides ───────────────────────────────────────────────────

    /// @notice Deposit assets, mint ASTRA shares to receiver
    function deposit(
        uint256 assets,
        address receiver
    ) public override nonReentrant returns (uint256 shares) {
        require(assets >= MIN_DEPOSIT, "AstraVault: below min deposit");
        require(receiver != address(0), "AstraVault: zero receiver");
        shares = super.deposit(assets, receiver);
    }

    /// @notice Mint exact shares, pull required assets from caller
    function mint(
        uint256 shares,
        address receiver
    ) public override nonReentrant returns (uint256 assets) {
        require(receiver != address(0), "AstraVault: zero receiver");
        assets = super.mint(shares, receiver);
    }

    /// @notice Withdraw assets by burning shares
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override nonReentrant returns (uint256 shares) {
        require(receiver != address(0), "AstraVault: zero receiver");
        shares = super.withdraw(assets, receiver, owner);
    }

    /// @notice Redeem shares for underlying assets
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override nonReentrant returns (uint256 assets) {
        require(receiver != address(0), "AstraVault: zero receiver");
        assets = super.redeem(shares, receiver, owner);
    }

    // ─── Fee Mechanism ───────────────────────────────────────────────────────

    /// @notice Called by EngineCore after each yield harvest cycle.
    ///         Mints fee shares into the vault itself (auto-compounded, pro-rata to all holders).
    /// @param newTotalAssets The updated total assets after yield was claimed
    function recordHarvest(uint256 newTotalAssets) external {
        require(msg.sender == engineCore, "AstraVault: only engine");

        uint256 profit = 0;
        if (newTotalAssets > lastHarvestAssets) {
            profit = newTotalAssets - lastHarvestAssets;
        }

        if (profit > 0) {
            uint256 supply = totalSupply();
            uint256 feeShares = VaultMath.calcPerformanceFeeShares(
                profit,
                PERFORMANCE_FEE_BPS,
                lastHarvestAssets,
                supply
            );

            if (feeShares > 0) {
                // Mint fee shares to vault itself → auto-compounded, benefits all holders
                _mint(address(this), feeShares);
                emit FeeCompounded(profit, feeShares, block.timestamp);
            }

            // Update APY
            uint256 period = block.timestamp - lastHarvestTime;
            if (period > 0) {
                currentAPYBps = VaultMath.computeAPY(profit, lastHarvestAssets, period);
                emit APYUpdated(currentAPYBps, block.timestamp);
            }

            totalYieldHarvested += profit;
        }

        lastHarvestAssets = newTotalAssets;
        lastHarvestTime = block.timestamp;
        emit HarvestRecorded(newTotalAssets, block.timestamp);
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    /// @notice Current share price scaled by 1e18
    function sharePrice() external view returns (uint256) {
        return VaultMath.sharePrice(totalAssets(), totalSupply());
    }

    /// @notice Get user position: shares held and equivalent assets
    function userPosition(address user) external view returns (uint256 shares, uint256 assets) {
        shares = balanceOf(user);
        assets = convertToAssets(shares);
    }

    /// @notice Total value locked
    function tvl() external view returns (uint256) {
        return totalAssets();
    }
}
