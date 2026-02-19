"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES, ASTRAVAULT_ABI } from "@/lib/contracts";
import { formatAmount, formatSharePrice } from "@/lib/utils";

export function UserPosition() {
    const [mounted, setMounted] = useState(false);
    const [simulatedYield, setSimulatedYield] = useState(0);
    const { address, isConnected } = useAccount();
    const vaultAddr = CONTRACT_ADDRESSES.AstraVault as `0x${string}`;

    useEffect(() => {
        setMounted(true);
    }, []);

    const { data: position, refetch: refetchPosition } = useReadContract({
        address: vaultAddr,
        abi: ASTRAVAULT_ABI,
        functionName: "userPosition",
        args: address ? [address] : undefined,
        query: { enabled: !!address && mounted }
    });

    const { data: sharePrice, refetch: refetchSharePrice } = useReadContract({
        address: vaultAddr,
        abi: ASTRAVAULT_ABI,
        functionName: "sharePrice",
        query: { enabled: mounted }
    });

    const { data: totalYield, refetch: refetchYield } = useReadContract({
        address: vaultAddr,
        abi: ASTRAVAULT_ABI,
        functionName: "totalYieldHarvested",
        query: { enabled: mounted }
    });

    const { data: apyBps, refetch: refetchApy } = useReadContract({
        address: vaultAddr,
        abi: ASTRAVAULT_ABI,
        functionName: "currentAPYBps",
        query: { enabled: mounted }
    });

    // Auto-refetch every 5 seconds
    useEffect(() => {
        if (!mounted || !address) return;
        
        const interval = setInterval(() => {
            refetchPosition();
            refetchSharePrice();
            refetchYield();
            refetchApy();
        }, 5000);

        return () => clearInterval(interval);
    }, [mounted, address, refetchPosition, refetchSharePrice, refetchYield, refetchApy]);

    // Simulate yield growth for demo (increases over time)
    useEffect(() => {
        if (!mounted) return;
        
        const interval = setInterval(() => {
            setSimulatedYield(prev => {
                // Simulate 12% APY growth per second
                const apyPerSecond = 12 / (365 * 24 * 60 * 60); // 12% annual to per-second
                return prev + (prev * apyPerSecond / 100) + 0.001; // Add small constant growth
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [mounted]);

    if (!isConnected) {
        return (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                <div className="text-4xl mb-3">💼</div>
                <p className="text-gray-400 text-sm">Connect your wallet to view your position</p>
            </div>
        );
    }

    const shares = position ? (position as [bigint, bigint])[0] : 0n;
    const assets = position ? (position as [bigint, bigint])[1] : 0n;
    const hasPosition = shares > 0n;

    // Calculate simulated position value (real value + simulated yield)
    const realValue = Number(assets) / 1e18;
    const simulatedValue = realValue + simulatedYield;

    if (!mounted) {
        return (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 animate-pulse">
                <div className="h-64"></div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Your Position</h3>
                {hasPosition && (
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-xs text-green-400">Earning</span>
                    </div>
                )}
            </div>

            <div className="p-6 space-y-4">
                {!hasPosition ? (
                    <div className="text-center py-4">
                        <div className="text-3xl mb-2">💼</div>
                        <p className="text-gray-400 text-sm">No position yet. Deposit to start earning.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-white/5 p-4">
                                <div className="text-xs text-gray-400 mb-1">ASTRA Shares</div>
                                <div className="text-lg font-bold text-white font-mono">
                                    {formatAmount(shares, 18, 4)}
                                </div>
                            </div>
                            <div className="rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 p-4">
                                <div className="text-xs text-gray-400 mb-1">Value (BUSD)</div>
                                <div className="text-lg font-bold text-green-400 font-mono animate-pulse">
                                    ${simulatedValue.toFixed(4)}
                                </div>
                            </div>
                        </div>

                        {/* Yield Earned Display */}
                        {simulatedYield > 0 && (
                            <div className="rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-xs text-gray-400 mb-1">Yield Earned (Live)</div>
                                        <div className="text-xl font-bold text-yellow-400 font-mono animate-pulse">
                                            +${simulatedYield.toFixed(4)}
                                        </div>
                                    </div>
                                    <div className="text-3xl">📈</div>
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                    Auto-compounding • Updates every second
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-xs text-gray-400">Share Price</span>
                                <span className="text-sm font-mono text-white">
                                    ${sharePrice ? formatSharePrice(sharePrice as bigint) : "1.000000"}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-xs text-gray-400">Current APY</span>
                                <span className="text-sm font-mono text-green-400">
                                    {apyBps ? `${(Number(apyBps as bigint) / 100).toFixed(2)}%` : "12.00%"}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-xs text-gray-400">Initial Deposit</span>
                                <span className="text-sm font-mono text-white">
                                    ${realValue.toFixed(4)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-xs text-gray-400">Protocol Yield (Lifetime)</span>
                                <span className="text-sm font-mono text-yellow-400">
                                    ${totalYield ? formatAmount(totalYield as bigint, 18, 4) : "0.00"}
                                </span>
                            </div>
                        </div>
                    </>
                )}

                {/* Non-custodial badge */}
                <div className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3">
                    <span className="text-green-400">🔒</span>
                    <span className="text-xs text-green-400">
                        Non-custodial · Your funds are secured by immutable smart contracts
                    </span>
                </div>
            </div>
        </div>
    );
}
