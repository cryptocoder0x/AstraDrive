# AstraDrive Smart Contract — Code Quality Analysis

> **Scope:** All Solidity files under `contracts/`  
> **Compiler:** `^0.8.20`  
> **Methodology:** Manual static review (no automated tool output is included)  
> **Note:** No fixes are applied in this document. All findings are for information only.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [AstraVault.sol](#2-astravaultsol)
3. [AutoCompounder.sol](#3-autocompoundersol)
4. [EngineCore.sol](#4-enginecoresol)
5. [StrategyRouter.sol](#5-strategyroutersol)
6. [VaultMath.sol (Library)](#6-vaultmathsol-library)
7. [VolatilityLib.sol (Library)](#7-volatilitylibsol-library)
8. [MockAsterEarn.sol / Mocks.sol](#8-mockasterearnsolmockssol)
9. [Interfaces](#9-interfaces)
10. [Cross-Cutting Concerns](#10-cross-cutting-concerns)
11. [Severity Summary Table](#11-severity-summary-table)

---

## 1. Executive Summary

AstraDrive is an autonomous, immutable yield protocol built on BNB Chain. It routes depositor capital between AsterDEX Earn and PancakeSwap LP positions based on on-chain volatility signals, auto-compounds rewards, and charges a performance fee that is re-distributed to all vault share-holders via dilution.

The overall architecture is clear and the code is well-commented. However, several **critical**, **high**, and **medium** severity issues were identified. The most notable are:

| # | Contract | Issue | Severity |
|---|----------|-------|----------|
| 1 | `StrategyRouter` | Zero slippage on LP removal | Critical |
| 2 | `VolatilityLib` | Spot-price oracle manipulable by flash loans | High |
| 3 | `AutoCompounder` | `rewardToken` and `tokenA` are always the same address | High |
| 4 | `AstraVault` | Fee shares minted to vault have no redemption path | High |
| 5 | `AstraVault` | `totalAssets()` not overridden — reflects only idle balance | High |
| 6 | `EngineCore` | `CALLER_INCENTIVE_BPS` defined but never implemented | Medium |
| 7 | `EngineCore` | Event emitted before `revert` is silently discarded | Medium |
| 8 | `StrategyRouter` | `totalManagedAssets()` returns the entire AsterEarn TVL | Medium |
| 9 | `StrategyRouter` | `_lpValueInTokenA` assumes `reserve0 == tokenA` | Medium |
| 10 | `VaultMath` | Possible overflow in `computeAPY` with large inputs | Low |

---

## 2. AstraVault.sol

### 2.1 `totalAssets()` not overridden (Severity: **High**)

`AstraVault` extends `ERC4626`, which implements `totalAssets()` as:

```solidity
return _asset.balanceOf(address(this));
```

Because deployed capital sits in `AutoCompounder` / `StrategyRouter` / `AsterEarn` — not inside the vault — the inherited `totalAssets()` will almost always undercount the real TVL. All share-price calculations, deposit/withdraw conversions, and the APY estimate in `recordHarvest` are therefore systematically wrong.

**Impact:** Users receive fewer shares on deposit and fewer assets on withdrawal than they are entitled to.

---

### 2.2 Fee shares minted to `address(this)` are unspendable (Severity: **High**)

```solidity
_mint(address(this), feeShares);   // AstraVault.sol line 128
```

The vault holds these shares permanently. There is:
- No `sweep()` or `claimFees()` function.
- No beneficiary address.
- No governance mechanism (by design).

Over time, fee shares accumulate and continuously dilute every depositor without any economic benefit to the protocol, team, or treasury. The NatSpec comment says "auto-compounded, benefits all holders," but minting to `address(this)` is value-neutral dilution — the minted shares represent claims on the same pool and merely lower every holder's percentage ownership.

---

### 2.3 Hardcoded testnet BUSD address (Severity: **Medium** / Deployment Risk)

```solidity
address public constant BUSD = 0xC57BFAf8FB2BE3DC1dcd49dC53ED37951C587596;
```

This address is embedded as a constant (not immutable) in three contracts (`AstraVault`, `AutoCompounder`, `StrategyRouter`). Deploying to mainnet or any network other than BSC Testnet will silently use a non-existent or incorrect token address.

---

### 2.4 `recordHarvest` does not validate `newTotalAssets` range (Severity: **Low**)

`newTotalAssets` is passed in by `EngineCore` and comes from `IAsterEarn(asterEarn).totalAssets()`. If the mock (or real) AsterEarn contract's value decreases (e.g., due to a loss), the condition `newTotalAssets > lastHarvestAssets` simply skips the fee — which is correct. However there is no lower-bound sanity check (e.g., minimum assets) and no event emitted for loss events, which reduces observability.

---

### 2.5 `MIN_DEPOSIT` comment is inconsistent (Severity: **Informational**)

`MIN_DEPOSIT = 1e6` is described as preventing "dust attacks," but BUSD has 18 decimals (the mainnet ERC-20 standard). On BNB Chain, BSC BUSD is typically 18 decimals as well. `1e6` therefore represents `0.000000000001 BUSD`, which provides no meaningful protection. If the intent is "1 BUSD minimum," the constant should be `1e18`.

---

## 3. AutoCompounder.sol

### 3.1 `rewardToken` and `tokenA` are identical (Severity: **High**)

```solidity
rewardToken = IERC20(BUSD);  // line 68
tokenA      = IERC20(BUSD);  // line 69
```

Both are hardcoded to `BUSD`. Inside `_convertRewardsToTokenA`, the early return fires every time:

```solidity
if (address(rewardToken) == address(tokenA)) {
    return rewardAmount;  // always taken
}
```

The swap path and `pancakeRouter` are never exercised. This means the contract carries swap infrastructure that is permanently dead. Either the reward token was intended to be a different token (e.g., ASTER or BNB), or the field is vestigial.

---

### 3.2 LP tokens accumulate in `AutoCompounder` with no accounting (Severity: **Medium**)

`_addLiquidityFromTokenA` mints LP tokens to `address(this)` (the `AutoCompounder`), but:
- There is no state variable tracking the LP balance.
- There is no `withdrawLP()` function.
- The `totalCompounded` counter accumulates `tokenAAmount` but never the LP value separately.
- The LP tokens are never fed back to the vault or re-deposited into AsterEarn.

Effectively, once capital is sent to the LP, it is locked inside `AutoCompounder` with no way to retrieve or report it.

---

### 3.3 Precision loss when `tokenAAmount` is odd (Severity: **Low**)

```solidity
uint256 halfForLP    = tokenAAmount / 2;
uint256 halfForAster = tokenAAmount - halfForLP;
```

When `tokenAAmount` is odd, `halfForAster` gets one extra unit. Inside `_addLiquidityFromTokenA`, `halfA` (the amount swapped to `tokenB`) and `otherHalf` suffer the same rounding. This is negligible for large amounts but creates a systematic 1-unit bias.

---

### 3.4 1% slippage on swaps leaves room for sandwich attacks (Severity: **Low**)

`SLIPPAGE_BPS = 100` (1%) is permissive for AMM swaps. Sophisticated MEV bots can reliably extract value from swaps with such wide tolerances, especially because `executeCycle()` is callable by anyone (no keeper whitelist).

---

## 4. EngineCore.sol

### 4.1 `CALLER_INCENTIVE_BPS` is never implemented (Severity: **Medium**)

```solidity
/// @notice Caller incentive: 0.1% of yield goes to cycle executor (gas refund)
uint256 public constant CALLER_INCENTIVE_BPS = 10;
```

No code in `executeCycle()` or any other function calculates or transfers a 0.1% incentive. The constant and its NatSpec are misleading: callers receive no gas refund, which reduces the economic incentive for keepers to execute cycles, potentially stalling the protocol.

---

### 4.2 Event emitted before `revert` is silently discarded (Severity: **Medium**)

```solidity
emit CycleCooldown(nextCycle);       // line 90
revert("EC: cooldown active");        // line 91
```

In EVM, a reverted transaction rolls back ALL state changes AND all events. The `CycleCooldown` event will never appear on-chain. Off-chain monitoring systems that try to listen for this event to determine cooldown state will see nothing. The emit should be removed or the revert replaced with a silent `return`.

---

### 4.3 Low-level `.call()` used instead of typed interface calls (Severity: **Low**)

```solidity
(bool ok, ) = strategyRouter.call(abi.encodeWithSignature("rebalance()"));
(bool compOk, ) = autoCompounder.call(abi.encodeWithSignature("compound()"));
(bool harvestOk, ) = vault.call(abi.encodeWithSignature("recordHarvest(uint256)", ...));
```

All three external calls use raw `.call()`. This bypasses:
- Compile-time type checking.
- Function selector verification.
- Return-value decoding.

Interfaces (`IStrategyRouter`, `IAutoCompounder`, `IAstraVault`) already exist for these contracts, and using them would be safer and more readable. The `require(ok, ...)` guards mitigate the most dangerous failure mode, but decoding returned values is not possible with this pattern.

---

### 4.4 `_getAsterBps` is a trivial one-line wrapper (Severity: **Informational**)

```solidity
function _getAsterBps(VolatilityLib.MarketMode mode) internal pure returns (uint256) {
    return VolatilityLib.getAsterAllocation(mode);
}
```

This function adds no value over a direct call to `VolatilityLib.getAsterAllocation`. It adds indirection without clarity.

---

## 5. StrategyRouter.sol

### 5.1 Zero slippage when removing liquidity (Severity: **Critical**)

```solidity
uint256 minA = 0; // slippage handled by caller context
uint256 minB = 0;
(uint256 amountA, uint256 amountB) = pancakeRouter.removeLiquidity(
    address(tokenA), address(tokenB),
    liquidity, minA, minB,   // ← both minimums are 0
    address(this), block.timestamp + 300
);
```

Passing `amountAMin = 0` and `amountBMin = 0` to `removeLiquidity` means a sandwich attack can front-run the transaction, drain the pool reserves, and cause the contract to receive near-zero assets in exchange for its LP tokens. Since `_removeLiquidity` is called both during `withdrawLP()` and on DRAWDOWN mode transitions (which any caller can trigger via `executeCycle()`), this is exploitable by any address.

---

### 5.2 `totalManagedAssets()` overstates assets (Severity: **Medium**)

```solidity
function totalManagedAssets() external view returns (uint256) {
    uint256 asterAssets = asterEarn.totalAssets();   // ← protocol-wide total
    uint256 lpValue     = _lpValueInTokenA();
    return asterAssets + lpValue;
}
```

`asterEarn.totalAssets()` returns the **total** assets deposited into AsterEarn by **all** users of that protocol — not only the `StrategyRouter`'s portion. This means `totalManagedAssets()` wildly overstates the strategy's actual position, which corrupts any off-chain or on-chain logic that reads this value.

---

### 5.3 `_lpValueInTokenA` assumes `reserve0` is always `tokenA` (Severity: **Medium**)

```solidity
(uint112 reserve0, , ) = lpPair.getReserves();
return (2 * uint256(reserve0) * lpBalance) / lpSupply;
```

PancakeSwap sorts pair tokens by address (lower address → token0). There is no guarantee that `tokenA` (BUSD) is `token0`. If `tokenA` happens to be `token1`, the returned value will measure reserve in the wrong token, producing an incorrect TVL figure.

---

### 5.4 `approve` used instead of `forceApprove` in `_removeLiquidity` (Severity: **Low**)

```solidity
lpPair.approve(address(pancakeRouter), liquidity);
```

All other approval calls in the codebase use `SafeERC20.forceApprove`. This inconsistency means a non-zero leftover allowance from a previous failed `removeLiquidity` could cause this line to silently fail on certain non-standard ERC-20 implementations.

---

### 5.5 `deployCapital` skips LP in DRAWDOWN but still deploys to Aster (Severity: **Informational**)

When `currentMode == DRAWDOWN`, no LP deployment occurs, but the Aster portion is still deployed. This is likely intentional (full Aster allocation in DRAWDOWN), but it creates a silent discrepancy with `asterAllocationBps`: capital may be sent to Aster even if `asterAllocationBps` is not 10000, because the LP portion is simply dropped (not redirected).

---

## 6. VaultMath.sol (Library)

### 6.1 Overflow risk in `computeAPY` (Severity: **Low**)

```solidity
return (yieldEarned * YEAR * BASIS_POINTS) / (principal * periodSeconds);
```

`YEAR = 365 days = 31,536,000` and `BASIS_POINTS = 10,000`. The numerator multiplication chain is:

```
yieldEarned * 31_536_000 * 10_000
```

If `yieldEarned` exceeds approximately `1.16 × 10^51` (an astronomically large token amount), this will overflow a `uint256`. For practical token amounts this is not reachable, but no comment explains this assumption.

---

### 6.2 `calcAllocation` does not validate `asterBps ≤ 10000` (Severity: **Low**)

If `asterBps > 10000` is ever passed (e.g., via a bug in `VolatilityLib.getAsterAllocation`), the expression `totalCapital - asterAmount` would revert with an underflow in Solidity 0.8+. This is a silent safety net from the compiler, not an explicit guard. Adding a `require(asterBps <= BASIS_POINTS)` check would surface the error earlier and more clearly.

---

### 6.3 `assetsToShares` initial-deposit comment is misleading (Severity: **Informational**)

```solidity
// Initial deposit: 1:1 ratio with 1e18 precision
return assets;
```

The comment says "1e18 precision" but the return value is `assets` without any scaling. For a 6-decimal token (e.g., USDC), the first depositor of `1,000,000` (1 USDC) receives `1,000,000` shares — no `1e18` scaling is applied. The comment is incorrect.

---

## 7. VolatilityLib.sol (Library)

### 7.1 Spot price is flash-loan manipulable (Severity: **High**)

```solidity
function getSpotPrice(address pair) internal view returns (uint256 price) {
    (uint112 reserve0, uint112 reserve1, ) = IPancakePair(pair).getReserves();
    if (reserve0 == 0) return 0;
    return (uint256(reserve1) * PRECISION) / uint256(reserve0);
}
```

AMM spot price reflects the current reserve ratio, which can be shifted by flash loans within a single transaction. An attacker can:

1. Flash-borrow a large amount of one token.
2. Swap it into the pair to skew the price.
3. Call `executeCycle()` (publicly accessible) which reads the manipulated spot price, triggers a DRAWDOWN rebalance (if deviation ≥ 8%), and forces `_removeLiquidity` with zero slippage.
4. Repay the flash loan.

The entire protocol capital allocation can thus be manipulated in a single atomic transaction. A TWAP oracle (e.g., UniswapV2-style cumulative price, Chainlink, or Band Protocol) should replace the spot price read.

---

### 7.2 Risk score threshold asymmetry (Severity: **Informational**)

`HIGH_THRESHOLD` (DRAWDOWN trigger) = 800 bps (8%)  
`riskScore` caps at 2000 bps (20%)

A DRAWDOWN state is entered at 8% deviation but the risk score only reaches 40/100 at that point (800/2000 × 100). The score is technically useful but the 0–100 scale communicates "moderate risk" when the protocol is already in its most defensive posture, which could confuse integrators.

---

## 8. MockAsterEarn.sol / Mocks.sol

### 8.1 `claimRewards` inflates `_totalAssets` without minting tokens (Severity: **Informational / Test-Only**)

```solidity
_totalAssets += reward;   // increases accounting balance
// but no tokens are minted to the contract
```

In the mock, `totalAssets()` returns an inflated number, but the contract holds no extra tokens. Any subsequent `withdraw()` that tries to transfer more than the actual underlying token balance will revert. This is acceptable for mocking cycles that do not fully exercise the withdraw path, but unit tests that call `claimRewards` followed by `withdraw` for full balance will fail unexpectedly.

---

### 8.2 `userShares` mapping can diverge from ERC20 balance (Severity: **Informational / Test-Only**)

`MockAsterEarn` inherits `ERC20` and tracks `userShares` separately. If shares are transferred between addresses (using the inherited `ERC20.transfer`), the `userShares` mapping will be inconsistent with actual ERC20 balances, causing incorrect `withdraw` calculations.

---

### 8.3 `MockPancakePair` has a public `totalSupply` state variable shadowing a function (Severity: **Informational / Test-Only**)

```solidity
uint256 public totalSupply = 1_000_000e18;
```

`totalSupply` is declared as a public state variable rather than a function, but `IPancakePair` does not declare it. The real PancakeSwap pair exposes `totalSupply()` as a view function (inherited from ERC20). This discrepancy means the mock cannot be used as a drop-in for `IPancakePair` interface calls to `totalSupply()` in typed contexts.

---

## 9. Interfaces

### 9.1 `IStrategyRouter` re-declares `MarketMode` enum (Severity: **Low**)

```solidity
// IStrategyRouter.sol
enum MarketMode { NORMAL, HIGH_VOLATILITY, DRAWDOWN }
```

`VolatilityLib` also defines `MarketMode`. Two separate definitions of the same enum exist. If the order or members ever diverge, ABI encoding will silently produce wrong values when passing enum values across contract boundaries. A single canonical definition (in `VolatilityLib`) should be referenced by the interface.

---

### 9.2 `IStrategyRouter` exposes `currentMode()` and `asterAllocation()` but `StrategyRouter` names them `currentMode` (state var) and `asterAllocationBps` (Severity: **Low**)

The public getter from `currentMode` (state variable) has signature `currentMode()` which matches the interface. However `asterAllocation()` in the interface does not match the auto-generated getter `asterAllocationBps()`. Any contract that calls `asterAllocation()` via the interface will fail. Similarly `lpAllocation()` vs `lpAllocationBps`.

---

## 10. Cross-Cutting Concerns

### 10.1 No emergency pause or circuit breaker (Design Decision / Risk)

By design, the protocol has no `Pausable` mechanism. In the event of an exploit or critical bug, there is no way to halt operations, freeze deposits/withdrawals, or protect user funds. This is a conscious trade-off between decentralization and safety. Users and integrators should be aware.

---

### 10.2 `executeCycle()` is publicly callable — MEV extraction risk (Severity: **Medium**)

Any EOA or contract can call `executeCycle()` at any time after the cooldown. Combined with:
- The zero-slippage LP removal (Finding 5.1)
- The flash-loan-manipulable spot price (Finding 7.1)

This creates a reliable path for MEV bots to profit at the expense of vault depositors.

---

### 10.3 Duplicate BUSD address constant (Severity: **Informational**)

`BUSD = 0xC57BFAf8FB2BE3DC1dcd49dC53ED37951C587596` is declared as a `public constant` independently in `AstraVault`, `AutoCompounder`, and `StrategyRouter`. A single shared constants file would reduce the risk of inconsistency.

---

### 10.4 No event coverage for loss events (Severity: **Low**)

The protocol emits events for yield/compounding but never emits events for capital losses (e.g., `recordHarvest` with `newTotalAssets < lastHarvestAssets`). Off-chain monitoring cannot distinguish a normal no-yield cycle from a loss event.

---

### 10.5 `block.timestamp + 300` deadline throughout (Severity: **Informational**)

Every DEX interaction uses a 5-minute deadline:

```solidity
block.timestamp + 300
```

This is a common pattern but means that if a transaction is stuck in the mempool for more than 5 minutes (e.g., due to gas price issues), it will expire and revert. In high-congestion scenarios, automated cycles may silently fail without any clear notification.

---

## 11. Severity Summary Table

| ID | File | Finding | Severity |
|----|------|---------|---------|
| SR-1 | `StrategyRouter.sol` | Zero slippage on LP removal allows full sandwich drain | **Critical** |
| AV-1 | `AstraVault.sol` | `totalAssets()` not overridden; reflects idle balance only | **High** |
| AV-2 | `AstraVault.sol` | Fee shares minted to vault have no redemption/use path | **High** |
| AC-1 | `AutoCompounder.sol` | `rewardToken == tokenA`; swap logic is dead code | **High** |
| VL-1 | `VolatilityLib.sol` | Spot price is flash-loan manipulable (no TWAP) | **High** |
| EC-1 | `EngineCore.sol` | `CALLER_INCENTIVE_BPS` declared but never implemented | **Medium** |
| EC-2 | `EngineCore.sol` | `emit CycleCooldown` before `revert` — event is discarded | **Medium** |
| EC-3 | `EngineCore.sol` | Low-level `.call()` bypasses type safety | **Medium** |
| SR-2 | `StrategyRouter.sol` | `totalManagedAssets()` returns all-protocol AsterEarn TVL | **Medium** |
| SR-3 | `StrategyRouter.sol` | `_lpValueInTokenA` assumes reserve0 == tokenA | **Medium** |
| CC-1 | Cross-cutting | `executeCycle()` publicly callable enables MEV cycles | **Medium** |
| AV-3 | `AstraVault.sol` | Hardcoded testnet BUSD address (3 contracts) | **Medium** |
| AC-2 | `AutoCompounder.sol` | LP tokens accumulate with no accounting or withdrawal path | **Medium** |
| IF-1 | `IStrategyRouter.sol` | `asterAllocation()` / `lpAllocation()` mismatch with impl | **Low** |
| IF-2 | `IStrategyRouter.sol` | Duplicate `MarketMode` enum definition | **Low** |
| SR-4 | `StrategyRouter.sol` | `approve` vs `forceApprove` inconsistency in `_removeLiquidity` | **Low** |
| VM-1 | `VaultMath.sol` | Potential overflow in `computeAPY` for astronomical values | **Low** |
| VM-2 | `VaultMath.sol` | `calcAllocation` lacks `asterBps ≤ 10000` guard | **Low** |
| AC-3 | `AutoCompounder.sol` | 1% swap slippage is exploitable by sandwich attacks | **Low** |
| CC-2 | Cross-cutting | No events emitted on capital loss | **Low** |
| AV-4 | `AstraVault.sol` | `MIN_DEPOSIT = 1e6` is dust for 18-decimal BUSD | **Informational** |
| VL-2 | `VolatilityLib.sol` | Risk score / DRAWDOWN threshold asymmetry (40/100 at max mode) | **Informational** |
| VM-3 | `VaultMath.sol` | `assetsToShares` initial-deposit comment claims "1e18 precision" incorrectly | **Informational** |
| EC-4 | `EngineCore.sol` | `_getAsterBps` is a trivial one-line wrapper | **Informational** |
| CC-3 | Cross-cutting | BUSD address duplicated as constant in 3 contracts | **Informational** |
| CC-4 | Cross-cutting | `block.timestamp + 300` deadline may expire in mempool congestion | **Informational** |
| MK-1 | `MockAsterEarn.sol` | `claimRewards` inflates accounting without minting tokens | **Informational (Test-Only)** |
| MK-2 | `MockAsterEarn.sol` | `userShares` mapping diverges from ERC20 balance on transfer | **Informational (Test-Only)** |
| MK-3 | `Mocks.sol` | `MockPancakePair.totalSupply` declared as state var, not function | **Informational (Test-Only)** |

---

*End of Analysis — No code changes were made.*
