"use client";

import { MetaMaskSDK } from '@metamask/sdk';

// BNB Chain Testnet configuration
export const BSC_TESTNET = {
  chainId: '0x61', // 97 in hex
  chainName: 'BNB Smart Chain Testnet',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'tBNB',
    decimals: 18,
  },
  rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
  blockExplorerUrls: ['https://testnet.bscscan.com/'],
};

export const REQUIRED_CHAIN_ID = 97;

// MetaMask SDK instance
export const metamaskSDK = typeof window !== 'undefined' ? new MetaMaskSDK({
  dappMetadata: {
    name: "AstraDrive",
    url: window.location.href,
  },
  preferDesktop: true,
}) : null;

export const getProvider = () => {
  return metamaskSDK?.getProvider();
};