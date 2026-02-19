"use client";

import { useEffect, useState } from "react";
import { useReadContract, useBlockNumber } from "wagmi";
import { CONTRACT_ADDRESSES, ASTRAVAULT_ABI, STRATEGYROUTER_ABI, ENGINECORE_ABI } from "@/lib/contracts";
import { useSimulatedMarket } from "@/lib/useSimulatedMarket";
import { CandlestickChart } from "./CandlestickChart";

export function HybridDashboard() {
    const [mounted, setMounted] = useState(false);
    
    // Get real blockchain data
    const vaultAddr = CONTRACT_ADDRESSES.AstraVault as `0x${string}`;
    const routerAddr = CONTRACT_ADDRESSES.StrategyRouter as `0x${string}`;
    const engineAddr = CONTRACT_ADDRESSES.EngineCore as `0x${string}`;

    const { data: blockNumber } = useBlockNumber({ watch: true });

    const { data: realTvl, refetch: refetchTvl } = useReadContract({
        address: vaultAddr,
        abi: ASTRAVAULT_ABI,
        functionName: "tvl",
    });

    const { data: realSharePrice, refetch: refetchSharePrice } = useReadContract({
        address: vaultAddr,
        abi: ASTRAVAULT_ABI,
        functionName: "sharePrice",
    });

    const { data: realApy, refetch: refetchApy } = useReadContract({
        address: vaultAddr,
        abi: ASTRAVAULT_ABI,
        functionName: "currentAPYBps",
    });

    const { data: asterAlloc, refetch: refetchAster } = useReadContract({
        address: routerAddr,
        abi: STRATEGYROUTER_ABI,
        functionName: "asterAllocationBps",
    });

    const { data: lpAlloc, refetch: refetchLp } = useReadContract({
        address: routerAddr,
        abi: STRATEGYROUTER_ABI,
        functionName: "lpAllocationBps",
    });

    const { data: riskScore, refetch: refetchRisk } = useReadContract({
        address: routerAddr,
        abi: STRATEGYROUTER_ABI,
        functionName: "riskScore",
    });

    const { data: mode, refetch: refetchMode } = useReadContract({
        address: routerAddr,
        abi: STRATEGYROUTER_ABI,
        functionName: "currentMode",
    });

    // Refetch on new blocks
    useEffect(() => {
        if (blockNumber) {
            refetchTvl();
            refetchSharePrice();
            refetchApy();
            refetchAster();
            refetchLp();
            refetchRisk();
            refetchMode();
        }
    }, [blockNumber]);

    // Convert real data to numbers
    const realTvlNum = realTvl ? Number(realTvl) / 1e18 : 0;
    const realSharePriceNum = realSharePrice ? Number(realSharePrice) / 1e18 : 1.0;
    const realApyNum = realApy ? Number(realApy) / 100 : 0;

    // Use simulated market with real data as base
    const { currentData, history, candles, isActive, setIsActive } = useSimulatedMarket({
        tvl: realTvlNum > 0 ? realTvlNum : 18.45,
        sharePrice: realSharePriceNum,
        apy: realApyNum > 0 ? realApyNum : 12.5,
    });

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-64 rounded-2xl bg-white/5"></div>
            </div>
        );
    }

    // Use real blockchain data for allocations if available
    const asterAllocation = asterAlloc ? Number(asterAlloc) / 100 : currentData.asterAllocation;
    const lpAllocation = lpAlloc ? Number(lpAlloc) / 100 : currentData.lpAllocation;
    const currentRisk = riskScore ? Number(riskScore) : currentData.riskScore;
    
    const marketModes = ["Normal", "High Volatility", "Drawdown"];
    const marketMode = mode !== undefined ? marketModes[Number(mode)] : currentData.marketMode;

    const modeColors = {
        "Normal": "text-green-400 bg-green-500/10 border-green-500/30",
        "High Volatility": "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
        "Drawdown": "text-red-400 bg-red-500/10 border-red-500/30",
    };

    return (
        <div className="space-y-6">
            {/* Live Indicator */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isActive ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
                        <span className="text-sm text-gray-400">
                            {isActive ? "Live Market Simulation" : "Paused"}
                        </span>
                    </div>
                    <button
                        onClick={() => setIsActive(!isActive)}
                        className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white transition-all"
                    >
                        {isActive ? "Pause" : "Resume"}
                    </button>
                    {realTvlNum > 0 && (
                        <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                            🔗 Connected to Blockchain
                        </span>
                    )}
                </div>
                <div className={`px-3 py-1.5 rounded-lg border text-sm font-bold ${modeColors[marketMode as keyof typeof modeColors]}`}>
                    {marketMode}
                </div>
            </div>

            {/* Main Stats - Hybrid (Real + Simulated) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <LiveStatCard
                    label="Total Value Locked"
                    value={`$${currentData.tvl.toFixed(2)}`}
                    subtext="BUSD equivalent"
                    icon="💰"
                    trend={history.length > 1 ? ((currentData.tvl - history[0].tvl) / history[0].tvl) * 100 : 0}
                    isReal={realTvlNum > 0}
                />
                <LiveStatCard
                    label="Share Price"
                    value={`$${currentData.sharePrice.toFixed(6)}`}
                    subtext="ASTRA per BUSD"
                    icon="📈"
                    trend={history.length > 1 ? ((currentData.sharePrice - history[0].sharePrice) / history[0].sharePrice) * 100 : 0}
                    isReal={realSharePriceNum > 1}
                />
                <LiveStatCard
                    label="Current APY"
                    value={`${currentData.apy.toFixed(2)}%`}
                    subtext="Auto-compounded"
                    icon="⚡"
                    trend={currentData.apy - (realApyNum || 12)}
                    isReal={realApyNum > 0}
                />
                <LiveStatCard
                    label="24h Volume"
                    value={`$${currentData.volume24h.toFixed(2)}`}
                    subtext="Trading volume"
                    icon="📊"
                    trend={0}
                    isReal={false}
                />
            </div>

            {/* Candlestick Chart */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                        Share Price Chart (Live Simulation)
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>Deviation: {currentData.priceDeviation.toFixed(2)}%</span>
                        <span>Risk: {currentRisk.toFixed(0)}/100</span>
                    </div>
                </div>
                <CandlestickChart candles={candles} height={250} />
                <div className="mt-3 text-xs text-gray-500 text-center">
                    {candles.length} candles • 5s intervals • Simulated market volatility
                </div>
            </div>

            {/* Dynamic Allocation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Capital Allocation - Real Data */}
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                            Capital Allocation
                        </h3>
                        {asterAlloc && (
                            <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                                On-Chain
                            </span>
                        )}
                    </div>

                    <div className="space-y-4">
                        {/* AsterDEX Earn */}
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">🔷 AsterDEX Earn</span>
                                <span className="text-white font-mono font-bold animate-pulse">
                                    {asterAllocation.toFixed(0)}%
                                </span>
                            </div>
                            <div className="h-4 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-1000 ease-out"
                                    style={{ width: `${asterAllocation}%` }}
                                />
                            </div>
                        </div>

                        {/* PancakeSwap LP */}
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">🥞 PancakeSwap LP</span>
                                <span className="text-white font-mono font-bold animate-pulse">
                                    {lpAllocation.toFixed(0)}%
                                </span>
                            </div>
                            <div className="h-4 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-1000 ease-out"
                                    style={{ width: `${lpAllocation}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-500">
                        ⚡ Allocation adjusts based on on-chain volatility detection
                    </div>
                </div>

                {/* Market Conditions */}
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                        Market Conditions
                    </h3>

                    <div className="space-y-4">
                        {/* Risk Score */}
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">Risk Score</span>
                                <span className="text-white font-mono font-bold">
                                    {currentRisk.toFixed(0)}/100
                                </span>
                            </div>
                            <div className="h-4 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-1000 ${
                                        currentRisk < 30
                                            ? "bg-gradient-to-r from-green-500 to-emerald-500"
                                            : currentRisk < 60
                                            ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                                            : "bg-gradient-to-r from-red-500 to-pink-500"
                                    }`}
                                    style={{ width: `${currentRisk}%` }}
                                />
                            </div>
                        </div>

                        {/* Price Deviation */}
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">Price Deviation</span>
                                <span className="text-white font-mono font-bold">
                                    {currentData.priceDeviation.toFixed(2)}%
                                </span>
                            </div>
                            <div className="h-4 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000"
                                    style={{ width: `${Math.min(100, currentData.priceDeviation * 10)}%` }}
                                />
                            </div>
                        </div>

                        {/* Mode Thresholds */}
                        <div className="grid grid-cols-3 gap-2 mt-4">
                            <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-2 text-center">
                                <div className="text-xs text-green-400 font-bold">Normal</div>
                                <div className="text-[10px] text-gray-500 mt-1">&lt; 3%</div>
                            </div>
                            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-2 text-center">
                                <div className="text-xs text-yellow-400 font-bold">High Vol</div>
                                <div className="text-[10px] text-gray-500 mt-1">3-8%</div>
                            </div>
                            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2 text-center">
                                <div className="text-xs text-red-400 font-bold">Drawdown</div>
                                <div className="text-[10px] text-gray-500 mt-1">&gt; 8%</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* TVL History Mini Chart */}
            {history.length > 10 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                        TVL History (Last {history.length} seconds)
                    </h3>
                    <div className="h-24 flex items-end gap-0.5">
                        {history.slice(-60).map((point, i) => {
                            const maxTvl = Math.max(...history.map((p) => p.tvl));
                            const minTvl = Math.min(...history.map((p) => p.tvl));
                            const range = maxTvl - minTvl || 1;
                            const height = ((point.tvl - minTvl) / range) * 100;
                            const color = point.tvl > (history[i - 1]?.tvl || point.tvl) ? "from-green-500/50" : "from-red-500/50";
                            return (
                                <div
                                    key={i}
                                    className={`flex-1 bg-gradient-to-t ${color} to-transparent rounded-t transition-all duration-300`}
                                    style={{ height: `${Math.max(5, height)}%` }}
                                    title={`$${point.tvl.toFixed(2)}`}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function LiveStatCard({
    label,
    value,
    subtext,
    icon,
    trend,
    isReal,
}: {
    label: string;
    value: string;
    subtext: string;
    icon: string;
    trend: number;
    isReal: boolean;
}) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 relative overflow-hidden group hover:border-yellow-400/30 transition-all">
            <div className="absolute top-0 right-0 text-5xl opacity-5 group-hover:opacity-10 transition-opacity">
                {icon}
            </div>
            {isReal && (
                <div className="absolute top-2 right-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" title="Real blockchain data" />
                </div>
            )}
            <div className="relative">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">{label}</div>
                <div className="text-2xl font-bold text-white font-mono mb-1 animate-pulse">{value}</div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{subtext}</span>
                    {trend !== 0 && (
                        <span className={`text-xs font-mono ${trend > 0 ? "text-green-400" : "text-red-400"}`}>
                            {trend > 0 ? "↗" : "↘"} {Math.abs(trend).toFixed(2)}%
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
