"use client";

import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected, metaMask } from "wagmi/connectors";

// ─── BNB Chain Testnet Definition ────────────────────────────────────────────
export const bscTestnet = defineChain({
    id: 97,
    name: "BNB Chain Testnet",
    nativeCurrency: {
        decimals: 18,
        name: "tBNB",
        symbol: "tBNB",
    },
    rpcUrls: {
        default: {
            http: ["https://data-seed-prebsc-1-s1.binance.org:8545/"],
        },
    },
    blockExplorers: {
        default: {
            name: "BscScan Testnet",
            url: "https://testnet.bscscan.com",
        },
    },
    testnet: true,
});

// ─── Wagmi Config ─────────────────────────────────────────────────────────────
export const wagmiConfig = createConfig({
    chains: [bscTestnet],
    connectors: [
        injected({
            target: 'metaMask',
            shimDisconnect: true,
        }),
        metaMask({
            dappMetadata: {
                name: 'AstraDrive',
                url: typeof window !== 'undefined' ? window.location.origin : '',
            },
        }),
    ],
    transports: {
        [bscTestnet.id]: http("https://data-seed-prebsc-1-s1.binance.org:8545/", {
            batch: false,
            retryCount: 3,
            timeout: 30000,
        }),
    },
    ssr: true,
    multiInjectedProviderDiscovery: true,
});

export const REQUIRED_CHAIN_ID = 97;
