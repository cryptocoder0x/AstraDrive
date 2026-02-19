// Contract addresses - update after deployment
// Run: npx hardhat run scripts/deploy.ts --network bscTestnet
// Then copy addresses from deployments/bscTestnet.json

export const CONTRACT_ADDRESSES = {
    AstraVault: "0xBD45c2546833941DF1193f9B33162FEB3283e33f",
    EngineCore: "0xb409A9fad12f4C83b963Dc18fe5295c3Bd5aaB05",
    StrategyRouter: "0x9b8e16EB4c92C951f8ed2DeF6FC2EBaA6F9B87cC",
    AutoCompounder: "0xa3FDb676640f8dC6A17935A7B92AC7137b9679d7",
    MockAsterEarn: "0x7d1216Ec906D61d697729D34D7a01965d2b8acb1",
    MockPancakePair: "0xF5f5490B6DeA32456a661B00657Fc99A5427ECc5",
    // BNB Testnet token addresses
    BUSD: "0xC57BFAf8FB2BE3DC1dcd49dC53ED37951C587596", // Your BUSD token
    WBNB: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
} as const;

export const ASTRAVAULT_ABI = [
    // ERC20 functions
    {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    // ERC4626 functions
    {
        inputs: [],
        name: "totalAssets",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            { name: "assets", type: "uint256" },
            { name: "receiver", type: "address" },
        ],
        name: "deposit",
        outputs: [{ name: "shares", type: "uint256" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            { name: "shares", type: "uint256" },
            { name: "receiver", type: "address" },
            { name: "owner", type: "address" },
        ],
        name: "redeem",
        outputs: [{ name: "assets", type: "uint256" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [{ name: "shares", type: "uint256" }],
        name: "convertToAssets",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    // AstraVault specific
    {
        inputs: [],
        name: "sharePrice",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "tvl",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "currentAPYBps",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "totalYieldHarvested",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [{ name: "user", type: "address" }],
        name: "userPosition",
        outputs: [
            { name: "shares", type: "uint256" },
            { name: "assets", type: "uint256" },
        ],
        stateMutability: "view",
        type: "function",
    },
] as const;

export const ENGINECORE_ABI = [
    {
        inputs: [],
        name: "canExecuteCycle",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "executeCycle",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "timeUntilNextCycle",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "currentMarketMode",
        outputs: [{ name: "", type: "uint8" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "currentRiskScore",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "totalCyclesExecuted",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

export const STRATEGYROUTER_ABI = [
    {
        inputs: [],
        name: "currentMode",
        outputs: [{ name: "", type: "uint8" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "asterAllocationBps",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "lpAllocationBps",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "totalManagedAssets",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "riskScore",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

export const ERC20_ABI = [
    {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        name: "allowance",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "symbol",
        outputs: [{ name: "", type: "string" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

export const MARKET_MODES = ["Normal", "High Volatility", "Drawdown"] as const;
export type MarketMode = (typeof MARKET_MODES)[number];
