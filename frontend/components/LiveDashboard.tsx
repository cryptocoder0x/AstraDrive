"use client";

import { useEffect, useState } from "react";
import { useSimulatedMarket } from "@/lib/useSimulatedMarket";
import { CandlestickChart } from "./CandlestickChart";

export function LiveDashboard() {
    const [mounted, setMounted] = useState(false);
    const { currentData, history, candles, isActive, setIsActive } = useSimulatedMarket({
        tvl: 18.45,
        sharePrice: 1.000123,
        apy: 12.5,
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
                            {isActive ? "Live Market Data" : "Paused"}
                        </span>
                    </div>
                    <button
                        onClick={() => setIsActive(!isActive)}
                        className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white transition-all"
                    >
                        {isActive ? "Pause" : "Resume"}
                    </button>
                </div>
                <div className={`px-3 py-1.5 rounded-lg border text-sm font-bold ${modeColors[currentData.marketMode]}`}>
                    {currentData.marketMode}
                </div>
            </div>

            {/* Main Stats - Live Updating */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <LiveStatCard
                    label="Total Value Locked"
                    value={`$${currentData.tvl.toFixed(2)}`}
                    subtext="BUSD equivalent"
                    icon="💰"
                    trend={history.length > 1 ? ((currentData.tvl - history[0].tvl) / history[0].tvl) * 100 : 0}
                />
                <LiveStatCard
                    label="Share Price"
                    value={`$${currentData.sharePrice.toFixed(6)}`}
                    subtext="ASTRA per BUSD"
                    icon="📈"
                    trend={history.length > 1 ? ((currentData.sharePrice - history[0].sharePrice) / history[0].sharePrice) * 100 : 0}
                />
                <LiveStatCard
                    label="Current APY"
                    value={`${currentData.apy.toFixed(2)}%`}
                    subtext="Auto-compounded"
                    icon="⚡"
                    trend={currentData.apy - 12}
                />
                <LiveStatCard
                    label="24h Volume"
                    value={`$${currentData.volume24h.toFixed(2)}`}
                    subtext="Trading volume"
                    icon="📊"
                    trend={0}
                />
            </div>

            {/* Candlestick Chart */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                        Share Price Chart (Live)
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>Deviation: {currentData.priceDeviation.toFixed(2)}%</span>
                        <span>Risk: {currentData.riskScore.toFixed(0)}/100</span>
                    </div>
                </div>
                <CandlestickChart candles={candles} height={250} />
                <div className="mt-3 text-xs text-gray-500 text-center">
                    {candles.length} candles • 5s intervals • Real-time market simulation
                </div>
            </div>

            {/* Dynamic Allocation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Capital Allocation - Animated */}
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                        Dynamic Capital Allocation
                    </h3>

                    <div className="space-y-4">
                        {/* AsterDEX Earn */}
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">🔷 AsterDEX Earn</span>
                                <span className="text-white font-mono font-bold animate-pulse">
                                    {currentData.asterAllocation}%
                                </span>
                            </div>
                            <div className="h-4 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-1000 ease-out"
                                    style={{ width: `${currentData.asterAllocation}%` }}
                                />
                            </div>
                        </div>

                        {/* PancakeSwap LP */}
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">🥞 PancakeSwap LP</span>
                                <span className="text-white font-mono font-bold animate-pulse">
                                    {currentData.lpAllocation}%
                                </span>
                            </div>
                            <div className="h-4 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-1000 ease-out"
                                    style={{ width: `${currentData.lpAllocation}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-500">
                        ⚡ Allocation adjusts automatically based on price deviation
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
                                    {currentData.riskScore.toFixed(0)}/100
                                </span>
                            </div>
                            <div className="h-4 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-1000 ${
                                        currentData.riskScore < 30
                                            ? "bg-gradient-to-r from-green-500 to-emerald-500"
                                            : currentData.riskScore < 60
                                            ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                                            : "bg-gradient-to-r from-red-500 to-pink-500"
                                    }`}
                                    style={{ width: `${currentData.riskScore}%` }}
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
}: {
    label: string;
    value: string;
    subtext: string;
    icon: string;
    trend: number;
}) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 relative overflow-hidden group hover:border-yellow-400/30 transition-all">
            <div className="absolute top-0 right-0 text-5xl opacity-5 group-hover:opacity-10 transition-opacity">
                {icon}
            </div>
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
