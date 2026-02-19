"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES, ASTRAVAULT_ABI, ERC20_ABI } from "@/lib/contracts";
import { formatAmount } from "@/lib/utils";

export function TransactionChecker() {
    const [mounted, setMounted] = useState(false);
    const [txHash, setTxHash] = useState("");
    const { address } = useAccount();
    
    useEffect(() => {
        setMounted(true);
    }, []);
    
    const vaultAddr = CONTRACT_ADDRESSES.AstraVault as `0x${string}`;
    const busdAddr = CONTRACT_ADDRESSES.BUSD as `0x${string}`;

    const { data: busdBalance } = useReadContract({
        address: busdAddr,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        query: { enabled: !!address && mounted },
    });

    const { data: astraBalance } = useReadContract({
        address: vaultAddr,
        abi: ASTRAVAULT_ABI,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        query: { enabled: !!address && mounted },
    });

    const { data: position } = useReadContract({
        address: vaultAddr,
        abi: ASTRAVAULT_ABI,
        functionName: "userPosition",
        args: address ? [address] : undefined,
        query: { enabled: !!address && mounted },
    });

    const shares = position ? (position as [bigint, bigint])[0] : 0n;
    const assets = position ? (position as [bigint, bigint])[1] : 0n;

    if (!mounted) return null;

    return (
        <div className="fixed bottom-4 left-4 bg-black/90 border border-white/20 rounded-lg p-4 text-xs font-mono text-white max-w-sm z-50">
            <div className="font-bold mb-2 text-yellow-400">🔍 Account Status</div>
            <div className="space-y-1">
                <div className="break-all">Address: {address?.slice(0, 10)}...{address?.slice(-8)}</div>
                <div>BUSD Balance: {busdBalance ? formatAmount(busdBalance as bigint, 18, 4) : "0"}</div>
                <div>ASTRA Balance: {astraBalance ? formatAmount(astraBalance as bigint, 18, 4) : "0"}</div>
                <div className="text-green-400">Shares: {formatAmount(shares, 18, 4)}</div>
                <div className="text-green-400">Value: ${formatAmount(assets, 18, 4)}</div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/20">
                <input
                    type="text"
                    placeholder="Paste tx hash to check"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs"
                />
                {txHash && (
                    <a
                        href={`https://testnet.bscscan.com/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline text-xs mt-1 block"
                    >
                        View on BscScan →
                    </a>
                )}
            </div>
        </div>
    );
}
