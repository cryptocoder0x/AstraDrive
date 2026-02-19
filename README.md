# AstraDrive – Autonomous Yield Engine

> **Self-Driving DeFi on BNB Chain Testnet** · No admin keys · No off-chain bots · 100% on-chain automation

[![BNB Testnet](https://img.shields.io/badge/Network-BNB%20Testnet-yellow)](https://testnet.bscscan.com)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue)](https://soliditylang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    AstraDrive Protocol                   │
│                                                          │
│  User ──deposit──▶ AstraVault (ERC4626 · ASTRA token)   │
│                         │                                │
│                    EngineCore                            │
│                   (anyone calls executeCycle())          │
│                    /          \                          │
│          StrategyRouter    AutoCompounder                │
│          /         \           │                         │
│   AsterDEX Earn  PancakeSwap  Harvest + Reinvest         │
│   (70–100%)      LP (0–30%)                              │
└─────────────────────────────────────────────────────────┘
```

---

## The Four Pillars

### 1️⃣ INTEGRATE – AsterDEX Earn
AsterDEX Earn is the **capital anchor** and primary yield primitive. All deposited capital first flows through AsterDEX Earn, which provides:
- Base layer yield (stable, predictable APY)
- Safe haven during high volatility (up to 100% allocation)
- Reward token emissions that are auto-harvested

### 2️⃣ STACK – Yield Stacking
Earned yield is programmatically re-deployed:
- `StrategyRouter` routes capital between Aster and PancakeSwap LP
- `AutoCompounder` harvests rewards → swaps → adds LP → re-deposits
- No human trigger needed — called by `EngineCore.executeCycle()`

### 3️⃣ AUTOMATE – Deterministic Cycles
`EngineCore.executeCycle()` is callable by **anyone**:
```solidity
// No onlyOwner. No privileged role. Pure state logic.
if (block.timestamp >= lastCycleTime + CYCLE_INTERVAL) {
    // 1. Detect volatility from LP reserves
    // 2. Rebalance if mode changed
    // 3. Compound rewards
    // 4. Record harvest for fee accounting
}
```

### 4️⃣ PROTECT – Non-Custodial Integrity
- ERC4626 vault: users hold **ASTRA** shares representing ownership
- No `withdrawAll`, no admin drain function
- Immutable contract addresses — no proxy pattern
- `ReentrancyGuard` + `SafeERC20` + checks-effects-interactions

---

## Strategy Modes

| Mode | Trigger | Aster | LP | Description |
|------|---------|-------|----|-------------|
| **Normal** | Price deviation < 3% | 70% | 30% | Balanced yield |
| **High Volatility** | Deviation 3–8% | 85% | 15% | Reduce LP risk |
| **Drawdown** | Deviation > 8% | 100% | 0% | Full preservation |

Volatility is computed **entirely on-chain** from PancakeSwap LP reserve deltas:
```solidity
uint256 deviation = VolatilityLib.priceDeviation(currentPrice, lastSnapshot);
MarketMode mode = VolatilityLib.getMarketMode(deviation); // pure function
```

---

## Why No Admin Key Improves Trust

Traditional DeFi protocols with admin keys create a single point of failure:
- Admin can drain funds, pause withdrawals, or change fee parameters
- Users must trust the team, not the code

AstraDrive has **zero admin surface**:
- No `owner` variable
- No `onlyOwner` modifier anywhere
- No `pause()` function
- No upgradeable proxy
- All addresses are `immutable` — set once at deploy, never changed

**Trust the math, not the team.**

---

## Economic Sustainability

### Performance Fee
- **10% of yield** is auto-compounded into the vault
- Minted as ASTRA shares to the vault itself
- Distributed **pro-rata** to all shareholders (increases share price)
- No admin fee, no withdrawal fee

### Compounding Math
```
Share Price = Total Assets / Total Shares
After harvest: new shares minted = (profit × 10%) / share_price
Result: share price increases for all holders
```

### Crash Survival
1. **Drawdown mode** triggers at 8% price deviation → 100% capital moves to Aster
2. LP positions are unwound before impermanent loss compounds
3. AsterDEX Earn continues generating base yield even in bear markets
4. No liquidation risk — vault holds assets, not leveraged positions

---

## Contract Architecture

```
contracts/
├── AstraVault.sol        # ERC4626 vault · ASTRA token · fee accounting
├── EngineCore.sol        # Autonomous cycle orchestrator (permissionless)
├── StrategyRouter.sol    # Capital routing + rebalance logic
├── AutoCompounder.sol    # Reward harvest + LP compounding
├── interfaces/
│   ├── IAsterEarn.sol    # AsterDEX Earn interface
│   ├── IPancakeRouter.sol
│   ├── IPancakePair.sol
│   ├── IStrategyRouter.sol
│   └── IAutoCompounder.sol
├── libraries/
│   ├── VaultMath.sol     # Share price, fee, APY calculations
│   └── VolatilityLib.sol # On-chain volatility detection
└── mocks/
    ├── MockAsterEarn.sol # Testnet simulation
    └── Mocks.sol         # Test helpers
```

---

## Security

| Feature | Implementation |
|---------|---------------|
| Reentrancy | `ReentrancyGuard` on all state-changing functions |
| Safe transfers | `SafeERC20` throughout |
| Slippage | 0.5–1% slippage controls on all swaps |
| No delegatecall | Never used |
| No selfdestruct | Never used |
| Immutable addresses | All external contracts set in constructor |
| CEI pattern | Checks → Effects → Interactions everywhere |

---

## Deployment

### Prerequisites
```bash
# 1. Clone and install
cd d:\Projects\AstraDrive
npm install

# 2. Copy and fill environment
cp .env.example .env
# Edit .env with your PRIVATE_KEY and BSCSCAN_API_KEY
```

### Deploy Contracts
```bash
npx hardhat run scripts/deploy.ts --network bscTestnet
```

### Update Frontend
After deployment, copy addresses from `deployments/bscTestnet.json` to `frontend/.env.local`:
```bash
cp frontend/.env.example frontend/.env.local
# Fill in the contract addresses
```

### Run Frontend
```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

### Verify on BscScan
```bash
npx hardhat run scripts/verify.ts --network bscTestnet
```

---

## Testing

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/AstraVault.test.ts
npx hardhat test test/EngineCore.test.ts
```

---

## Network Configuration

| Parameter | Value |
|-----------|-------|
| Network | BNB Chain Testnet |
| Chain ID | 97 |
| RPC | https://data-seed-prebsc-1-s1.binance.org:8545/ |
| Explorer | https://testnet.bscscan.com |
| Faucet | https://testnet.bnbchain.org/faucet-smart |

---

## Demo Script (3-min video)

1. Open `http://localhost:3000`
2. Click **Connect MetaMask** → auto-switches to Chain ID 97
3. Show tBNB balance in header
4. Enter deposit amount → Approve BUSD → Deposit
5. Show ASTRA shares minted in "Your Position"
6. Show TVL increase in Dashboard
7. Show allocation bars (70% Aster / 30% LP)
8. Wait for cycle interval or call `executeCycle()` from any wallet
9. Show APY update, yield harvested
10. Show mode indicator (Normal → High Vol if price moves)
11. Withdraw: redeem ASTRA → receive BUSD

---

## License

MIT — No rights reserved. Trust the code.
