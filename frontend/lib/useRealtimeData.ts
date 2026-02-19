"use client";

import { useEffect, useState } from "react";
import { useReadContract, useBlockNumber } from "wagmi";
import { CONTRACT_ADDRESSES, ASTRAVAULT_ABI, STRATEGYROUTER_ABI, ENGINECORE_ABI } from "./contracts";

export interface RealtimeVaultData {
    tvl: bigint;
    sharePrice: bigint;
    apyBps: bigint;
    totalYield: bigint;
    asterAllocation: bigint;
    lpAllocation: bigint;
    marketMode: number;
    riskScore: bigint;
    canExecuteCycle: boolean;
    totalCycles: bigint;
}

export function useRealtimeVaultData() {
    const [data, setData] = useState<RealtimeVaultData | null>(null);
    const [history, setHistory] = useState<Array<{ timestamp: number; tvl: number; apy: number }>>([]);

    // Watch for new blocks to trigger updates
    const { data: blockNumber } = useBlockNumber({ watch: true });

    const vaultAddr = CONTRACT_ADDRESSES.AstraVault as `0x${string}`;
    const routerAddr = CONTRACT_ADDRESSES.StrategyRouter as `0x${string}`;
    const engineAddr = CONTRACT_ADDRESSES.EngineCore as `0x${string}`;

    // Vault data
    const { data: tvl, refetch: refetchTvl } = useReadContract({
        address: vaultAddr,
        abi: ASTRAVAULT_ABI,
        functionName: "tvl",
    });

    const { data: sharePrice, refetch: refetchSharePrice } = useReadContract({
        address: vaultAddr,
        abi: ASTRAVAULT_ABI,
        functionName: "sharePrice",
    });

    const { data: apyBps, refetch: refetchApy } = useReadContract({
        address: vaultAddr,
        abi: ASTRAVAULT_ABI,
        functionName: "currentAPYBps",
    });

    const { data: totalYield, refetch: refetchYield } = useReadContract({
        address: vaultAddr,
        abi: ASTRAVAULT_ABI,
        functionName: "totalYieldHarvested",
    });

    // Router data
    const { data: asterAllocation, refetch: refetchAster } = useReadContract({
        address: routerAddr,
        abi: STRATEGYROUTER_ABI,
        functionName: "asterAllocationBps",
    });

    const { data: lpAllocation, refetch: refetchLp } = useReadContract({
        address: routerAddr,
        abi: STRATEGYROUTER_ABI,
        functionName: "lpAllocationBps",
    });

    const { data: marketMode, refetch: refetchMode } = useReadContract({
        address: routerAddr,
        abi: STRATEGYROUTER_ABI,
        functionName: "currentMode",
    });

    const { data: riskScore, refetch: refetchRisk } = useReadContract({
        address: routerAddr,
        abi: STRATEGYROUTER_ABI,
        functionName: "riskScore",
    });

    // Engine data
    const { data: canExecuteCycle, refetch: refetchCycle } = useReadContract({
        address: engineAddr,
        abi: ENGINECORE_ABI,
        functionName: "canExecuteCycle",
    });

    const { data: totalCycles, refetch: refetchTotalCycles } = useReadContract({
        address: engineAddr,
        abi: ENGINECORE_ABI,
        functionName: "totalCyclesExecuted",
    });

    // Refetch all data when block changes
    useEffect(() => {
        if (blockNumber) {
            refetchTvl();
            refetchSharePrice();
            refetchApy();
            refetchYield();
            refetchAster();
            refetchLp();
            refetchMode();
            refetchRisk();
            refetchCycle();
            refetchTotalCycles();
        }
    }, [blockNumber]);

    // Update data state
    useEffect(() => {
        if (
            tvl !== undefined &&
            sharePrice !== undefined &&
            apyBps !== undefined &&
            totalYield !== undefined &&
            asterAllocation !== undefined &&
            lpAllocation !== undefined &&
            marketMode !== undefined &&
            riskScore !== undefined &&
            canExecuteCycle !== undefined &&
            totalCycles !== undefined
        ) {
            const newData: RealtimeVaultData = {
                tvl: tvl as bigint,
                sharePrice: sharePrice as bigint,
                apyBps: apyBps as bigint,
                totalYield: totalYield as bigint,
                asterAllocation: asterAllocation as bigint,
                lpAllocation: lpAllocation as bigint,
                marketMode: marketMode as number,
                riskScore: riskScore as bigint,
                canExecuteCycle: canExecuteCycle as boolean,
                totalCycles: totalCycles as bigint,
            };
            setData(newData);

            // Add to history for charts (keep last 50 data points)
            setHistory((prev) => {
                const newPoint = {
                    timestamp: Date.now(),
                    tvl: Number(tvl) / 1e18,
                    apy: Number(apyBps) / 100,
                };
                const updated = [...prev, newPoint];
                return updated.slice(-50); // Keep last 50 points
            });
        }
    }, [tvl, sharePrice, apyBps, totalYield, asterAllocation, lpAllocation, marketMode, riskScore, canExecuteCycle, totalCycles]);

    return { data, history };
}
