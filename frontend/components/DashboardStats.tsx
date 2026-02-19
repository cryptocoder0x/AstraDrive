"use client";

import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES, ASTRAVAULT_ABI, ENGINECORE_ABI, STRATEGYROUTER_ABI, MARKET_MODES } from "@/lib/contracts";
import { formatAmount, formatAPY, formatPercent, formatSharePrice, formatTimeRemaining } from "@/lib/utils";

function StatCard({
    label,
    value,
    sub,
    accent = "blue",
    icon,
}: {
    label: string;
    value: string;
    sub?: string;
    accent?: "blue" | "green" | "yellow" | "purple" | "orange";
    icon: string;
}) {
    const accents = {
        blue: "from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-400",
        green: "from-green-500/20 to-green-600/5 border-green-500/20 text-green-400",
        yellow: "from-yellow-500/20 to-yellow-600/5 border-yellow-500/20 text-yellow-400",
        purple: "from-purple-500/20 to-purple-600/5 border-purple-500/20 text-purple-400",
        orange: "from-orange-500/20 to-orange-600/5 border-orange-500/20 text-orange-400",
    };

    return (
        <div className={`relative rounded-2xl border bg-gradient-to-br p-5 ${accents[accent]} backdrop-blur-sm`}>
            <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{icon}</span>
                <span className={`text-xs font-semibold uppercase tracking-wider opacity-70`}>{label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
            {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
        </div>
    );
}

export function DashboardStats() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const vaultAddr = CONTRACT_ADDRESSES.AstraVault as `0x${string}`;
    const engineAddr = CONTRACT_ADDRESSES.EngineCore as `0x${string}`;
    const routerAddr = CONTRACT_ADDRESSES.StrategyRouter as `0x${string}`;

    const { data: tvl } = useReadContract({ address: vaultAddr, abi: ASTRAVAULT_ABI, functionName: "tvl", query: { enabled: mounted } });
    const { data: apyBps } = useReadContract({ address: vaultAddr, abi: ASTRAVAULT_ABI, functionName: "currentAPYBps", query: { enabled: mounted } });
    const { data: sharePrice } = useReadContract({ address: vaultAddr, abi: ASTRAVAULT_ABI, functionName: "sharePrice", query: { enabled: mounted } });
    const { data: totalYield } = useReadContract({ address: vaultAddr, abi: ASTRAVAULT_ABI, functionName: "totalYieldHarvested", query: { enabled: mounted } });
    const { data: asterBps } = useReadContract({ address: routerAddr, abi: STRATEGYROUTER_ABI, functionName: "asterAllocationBps", query: { enabled: mounted } });
    const { data: lpBps } = useReadContract({ address: routerAddr, abi: STRATEGYROUTER_ABI, functionName: "lpAllocationBps", query: { enabled: mounted } });
    const { data: timeUntil } = useReadContract({ address: engineAddr, abi: ENGINECORE_ABI, functionName: "timeUntilNextCycle", query: { enabled: mounted } });
    const { data: totalCycles } = useReadContract({ address: engineAddr, abi: ENGINECORE_ABI, functionName: "totalCyclesExecuted", query: { enabled: mounted } });
    const { data: riskScore } = useReadContract({ address: routerAddr, abi: STRATEGYROUTER_ABI, functionName: "riskScore", query: { enabled: mounted } });
    const { data: mode } = useReadContract({ address: routerAddr, abi: STRATEGYROUTER_ABI, functionName: "currentMode", query: { enabled: mounted } });

    const modeName = mode !== undefined ? MARKET_MODES[Number(mode)] : "Normal";
    const risk = riskScore ? Number(riskScore) : 0;

    if (!mounted) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-5 animate-pulse">
                            <div className="h-20"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Primary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total Value Locked"
                    value={tvl ? `$${formatAmount(tvl as bigint, 18, 2)}` : "$—"}
                    sub="BUSD equivalent"
                    accent="blue"
                    icon="$"
                />
                <StatCard
                    label="Current APY"
                    value={apyBps ? formatAPY(apyBps as bigint) : "—"}
                    sub="Auto-compounded"
                    accent="green"
                    icon="%"
                />
                <StatCard
                    label="Share Price"
                    value={sharePrice ? `$${formatSharePrice(sharePrice as bigint)}` : "$1.000000"}
                    sub="ASTRA per BUSD"
                    accent="yellow"
                    icon="*"
                />
                <StatCard
                    label="Total Yield Harvested"
                    value={totalYield ? `$${formatAmount(totalYield as bigint, 18, 2)}` : "$0.00"}
                    sub="Lifetime earnings"
                    accent="purple"
                    icon="+"
                />
            </div>

            {/* Allocation + Engine Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Allocation Bar */}
                <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Capital Allocation</h3>
                        <span className="text-xs text-gray-500">{asterBps ? formatPercent(asterBps as bigint) : "70%"} / {lpBps ? formatPercent(lpBps as bigint) : "30%"}</span>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                                <span>( ) AsterDEX Earn</span>
                                <span className="font-mono">{asterBps ? formatPercent(asterBps as bigint) : "70.0%"}</span>
                            </div>
                            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-1000"
                                    style={{ width: asterBps ? `${Number(asterBps as bigint) / 100}%` : "70%" }}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                                <span>( ) PancakeSwap LP</span>
                                <span className="font-mono">{lpBps ? formatPercent(lpBps as bigint) : "30.0%"}</span>
                            </div>
                            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-orange-400 transition-all duration-1000"
                                    style={{ width: lpBps ? `${Number(lpBps as bigint) / 100}%` : "30%" }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Engine Status */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Engine Status</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Next Cycle</span>
                            <span className="text-sm font-mono text-white">
                                {timeUntil !== undefined ? formatTimeRemaining(timeUntil as bigint) : "—"}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Cycles Run</span>
                            <span className="text-sm font-mono text-white">{totalCycles?.toString() ?? "0"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Risk Score</span>
                            <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${risk < 30 ? "bg-green-400" : risk < 60 ? "bg-yellow-400" : "bg-red-400"}`}
                                        style={{ width: `${risk}%` }}
                                    />
                                </div>
                                <span className="text-sm font-mono text-white">{risk}/100</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Mode</span>
                            <ModeChip mode={modeName} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ModeChip({ mode }: { mode: string }) {
    const styles: Record<string, string> = {
        "Normal": "bg-green-500/20 text-green-400 border-green-500/30",
        "High Volatility": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        "Drawdown": "bg-red-500/20 text-red-400 border-red-500/30",
    };
    const icons: Record<string, string> = {
        "Normal": "OK",
        "High Volatility": "!!",
        "Drawdown": "!!",
    };
    return (
        <span className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${styles[mode] ?? styles["Normal"]}`}>
            {icons[mode] ?? "OK"} {mode}
        </span>
    );
}
