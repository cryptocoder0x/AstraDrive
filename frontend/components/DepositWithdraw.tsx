"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { CONTRACT_ADDRESSES, ASTRAVAULT_ABI, ERC20_ABI } from "@/lib/contracts";
import { formatAmount } from "@/lib/utils";

type Tab = "deposit" | "withdraw";

export function DepositWithdraw() {
    const [tab, setTab] = useState<Tab>("deposit");
    const [amount, setAmount] = useState("");
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const { address } = useAccount();
    const vaultAddr = CONTRACT_ADDRESSES.AstraVault as `0x${string}`;
    const busdAddr = CONTRACT_ADDRESSES.BUSD as `0x${string}`;

    // Read balances
    const { data: busdBalance, refetch: refetchBusd } = useReadContract({
        address: busdAddr,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        query: { enabled: !!address && mounted }
    });

    const { data: astraBalance, refetch: refetchAstra } = useReadContract({
        address: vaultAddr,
        abi: ASTRAVAULT_ABI,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        query: { enabled: !!address && mounted }
    });

    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: busdAddr,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: address ? [address, vaultAddr] : undefined,
        query: { enabled: !!address && mounted }
    });

    const { writeContract, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

    // Refetch balances when transaction succeeds
    useEffect(() => {
        if (isSuccess) {
            setTimeout(() => {
                refetchBusd();
                refetchAstra();
                refetchAllowance();
            }, 2000); // Wait 2 seconds for blockchain to update
        }
    }, [isSuccess, refetchBusd, refetchAstra, refetchAllowance]);

    const parsedAmount = amount ? parseUnits(amount, 18) : 0n;
    const needsApproval = tab === "deposit" && allowance !== undefined && parsedAmount > (allowance as bigint);

    const handleApprove = () => {
        writeContract(
            {
                address: busdAddr,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [vaultAddr, parsedAmount],
                gas: 60000n, // Sufficient for approve
            },
            { onSuccess: (hash) => { setTxHash(hash); refetchAllowance(); } }
        );
    };

    const handleDeposit = () => {
        if (!address || !parsedAmount) return;
        writeContract(
            {
                address: vaultAddr,
                abi: ASTRAVAULT_ABI,
                functionName: "deposit",
                args: [parsedAmount, address],
                gas: 300000n, // Increased gas for deposit - ERC4626 deposit is complex
            },
            { onSuccess: (hash) => { setTxHash(hash); setAmount(""); } }
        );
    };

    const handleWithdraw = () => {
        if (!address || !parsedAmount) return;
        writeContract(
            {
                address: vaultAddr,
                abi: ASTRAVAULT_ABI,
                functionName: "redeem",
                args: [parsedAmount, address, address],
                gas: 250000n, // Sufficient gas for redeem
            },
            { onSuccess: (hash) => { setTxHash(hash); setAmount(""); } }
        );
    };

    const maxAmount = tab === "deposit" ? busdBalance : astraBalance;

    if (!mounted) {
        return (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
                <div className="flex border-b border-white/10">
                    <div className="flex-1 py-4 text-sm font-semibold text-center">Loading...</div>
                </div>
                <div className="p-6 h-64 animate-pulse"></div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-white/10">
                {(["deposit", "withdraw"] as Tab[]).map((t) => (
                    <button
                        key={t}
                        onClick={() => { setTab(t); setAmount(""); }}
                        className={`flex-1 py-4 text-sm font-semibold capitalize transition-all ${tab === t
                            ? "bg-white/10 text-white border-b-2 border-yellow-400"
                            : "text-gray-400 hover:text-gray-200"
                            }`}
                    >
                        {t === "deposit" ? "⬇️ Deposit" : "⬆️ Withdraw"}
                    </button>
                ))}
            </div>

            <div className="p-6 space-y-4">
                {/* Token label */}
                <div className="flex justify-between items-center text-xs text-gray-400">
                    <span>{tab === "deposit" ? "You deposit (BUSD)" : "You redeem (ASTRA shares)"}</span>
                    <span>
                        Balance:{" "}
                        <button
                            className="text-yellow-400 hover:underline font-mono"
                            onClick={() => setAmount(maxAmount ? formatAmount(maxAmount as bigint, 18, 6).replace(/,/g, "") : "")}
                        >
                            {maxAmount ? formatAmount(maxAmount as bigint, 18, 4) : "0.00"}
                        </button>
                    </span>
                </div>

                {/* Amount input */}
                <div className="relative">
                    <input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white text-xl font-mono placeholder-gray-600 focus:outline-none focus:border-yellow-400/50 transition-all"
                    />
                    <button
                        onClick={() => setAmount(maxAmount ? formatAmount(maxAmount as bigint, 18, 6).replace(/,/g, "") : "")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-yellow-400/20 text-yellow-400 text-xs font-bold hover:bg-yellow-400/30 transition-all"
                    >
                        MAX
                    </button>
                </div>

                {/* Action buttons */}
                {!mounted || !address ? (
                    <div className="text-center text-gray-400 text-sm py-2">Connect wallet to continue</div>
                ) : tab === "deposit" ? (
                    <div className="space-y-3">
                        {needsApproval && (
                            <button
                                onClick={handleApprove}
                                disabled={isPending || isConfirming || !parsedAmount}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-all"
                            >
                                {isPending || isConfirming ? "Approving..." : "1. Approve BUSD"}
                            </button>
                        )}
                        <button
                            onClick={handleDeposit}
                            disabled={isPending || isConfirming || !parsedAmount || needsApproval}
                            className="w-full py-4 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-all shadow-lg shadow-orange-500/20"
                        >
                            {isPending || isConfirming ? "Depositing..." : "Deposit & Mint ASTRA"}
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleWithdraw}
                        disabled={isPending || isConfirming || !parsedAmount}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-all shadow-lg shadow-purple-500/20"
                    >
                        {isPending || isConfirming ? "Withdrawing..." : "Redeem ASTRA → BUSD"}
                    </button>
                )}

                {/* Transaction status */}
                {txHash && (
                    <div className={`text-center text-xs rounded-lg p-3 ${isSuccess ? "bg-green-500/10 text-green-400" : "bg-white/5 text-gray-400"}`}>
                        {isSuccess ? "✅ Transaction confirmed!" : isConfirming ? "⏳ Confirming..." : "📤 Submitted"}
                        {" "}
                        <a
                            href={`https://testnet.bscscan.com/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-white"
                        >
                            View on BscScan
                        </a>
                    </div>
                )}

                {/* Info */}
                <div className="text-xs text-gray-500 text-center">
                    {tab === "deposit"
                        ? "Capital is automatically routed to AsterDEX Earn + PancakeSwap LP"
                        : "Shares are burned and proportional BUSD returned to your wallet"}
                </div>
            </div>
        </div>
    );
}
