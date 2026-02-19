"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortenAddress } from "@/lib/utils";
import { useEffect, useState } from "react";

export function WalletBar() {
    const [mounted, setMounted] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const { connectors, connect, error: connectError } = useConnect();
    const { address, isConnected, chainId } = useAccount();
    const { disconnect } = useDisconnect();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (connectError) {
            console.error('Connection error:', connectError);
            setIsConnecting(false);
        }
    }, [connectError]);

    const isWrongChain = isConnected && chainId !== 97;

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            // Check if MetaMask is installed
            if (typeof window.ethereum === 'undefined') {
                alert('MetaMask is not installed. Please install MetaMask extension from https://metamask.io/download/');
                setIsConnecting(false);
                return;
            }

            // Find injected connector
            const injectedConnector = connectors.find(c => c.id === 'injected' || c.name.toLowerCase().includes('metamask'));
            
            if (injectedConnector) {
                await connect({ connector: injectedConnector });
            } else {
                console.error('No connector found. Available connectors:', connectors);
                alert('Unable to find MetaMask connector. Please refresh the page.');
            }
        } catch (error) {
            console.error('Failed to connect:', error);
            alert('Failed to connect to MetaMask. Please try again.');
        } finally {
            setIsConnecting(false);
        }
    };

    if (!mounted) {
        return (
            <button
                disabled
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold text-sm opacity-50"
            >
                Loading...
            </button>
        );
    }

    if (!isConnected) {
        return (
            <div className="flex flex-col items-end gap-2">
                <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-orange-500/30 disabled:opacity-50"
                >
                    {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
                </button>
                {connectError && (
                    <span className="text-xs text-red-400">
                        {connectError.message || 'Connection failed'}
                    </span>
                )}
            </div>
        );
    }

    if (isWrongChain) {
        return (
            <div className="flex items-center gap-3">
                <span className="text-red-400 text-sm font-medium">⚠️ Wrong Network</span>
                <button
                    onClick={async () => {
                        try {
                            await (window as any).ethereum?.request({
                                method: 'wallet_switchEthereumChain',
                                params: [{ chainId: '0x61' }], // 97 in hex
                            });
                        } catch (error: any) {
                            if (error.code === 4902) {
                                // Chain not added, add it
                                await (window as any).ethereum?.request({
                                    method: 'wallet_addEthereumChain',
                                    params: [{
                                        chainId: '0x61',
                                        chainName: 'BNB Smart Chain Testnet',
                                        nativeCurrency: { name: 'BNB', symbol: 'tBNB', decimals: 18 },
                                        rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
                                        blockExplorerUrls: ['https://testnet.bscscan.com/'],
                                    }],
                                });
                            } else {
                                console.error('Failed to switch network:', error);
                            }
                        }
                    }}
                    className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-semibold hover:bg-red-500/30 transition-all"
                >
                    Switch to BNB Testnet
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm text-gray-200 font-mono">{shortenAddress(address!)}</span>
            </div>
            <button
                onClick={() => disconnect()}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm hover:bg-white/10 hover:text-white transition-all"
            >
                Disconnect
            </button>
        </div>
    );
}
