"use client";

import { useChainId, useAccount } from "wagmi";
import { REQUIRED_CHAIN_ID } from "@/lib/wagmiConfig";

export function ChainGuard({ children }: { children: React.ReactNode }) {
    const { isConnected } = useAccount();
    const chainId = useChainId();

    if (isConnected && chainId !== REQUIRED_CHAIN_ID) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-3xl">
                    ⚠️
                </div>
                <h3 className="text-xl font-bold text-white">Wrong Network</h3>
                <p className="text-gray-400 text-center max-w-sm">
                    AstraDrive runs on <span className="text-yellow-400 font-semibold">BNB Chain Testnet</span> (Chain ID 97).
                    Please switch your network in MetaMask.
                </p>
            </div>
        );
    }

    return <>{children}</>;
}
