"use client";

import { useState, useEffect, useCallback } from 'react';
import { getProvider, BSC_TESTNET, REQUIRED_CHAIN_ID } from './metamaskConfig';

interface MetaMaskState {
  account: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  balance: string | null;
}

export function useMetaMask() {
  const [state, setState] = useState<MetaMaskState>({
    account: null,
    chainId: null,
    isConnected: false,
    isConnecting: false,
    balance: null,
  });

  const provider = getProvider();

  const updateAccount = useCallback(async () => {
    if (!provider) return;

    try {
      const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
      const chainId = await provider.request({ method: 'eth_chainId' }) as string;
      
      if (accounts.length > 0) {
        const balance = await provider.request({
          method: 'eth_getBalance',
          params: [accounts[0], 'latest']
        }) as string;

        setState({
          account: accounts[0],
          chainId: parseInt(chainId, 16),
          isConnected: true,
          isConnecting: false,
          balance: balance,
        });
      } else {
        setState({
          account: null,
          chainId: parseInt(chainId, 16),
          isConnected: false,
          isConnecting: false,
          balance: null,
        });
      }
    } catch (error) {
      console.error('Error updating account:', error);
      setState(prev => ({ ...prev, isConnecting: false }));
    }
  }, [provider]);

  const connect = useCallback(async () => {
    if (!provider) return;

    setState(prev => ({ ...prev, isConnecting: true }));

    try {
      await provider.request({ method: 'eth_requestAccounts' });
      await updateAccount();
    } catch (error) {
      console.error('Error connecting:', error);
      setState(prev => ({ ...prev, isConnecting: false }));
    }
  }, [provider, updateAccount]);

  const disconnect = useCallback(async () => {
    setState({
      account: null,
      chainId: null,
      isConnected: false,
      isConnecting: false,
      balance: null,
    });
  }, []);

  const switchChain = useCallback(async () => {
    if (!provider) return;

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BSC_TESTNET.chainId }],
      });
    } catch (switchError: any) {
      // Chain not added to MetaMask
      if (switchError.code === 4902) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [BSC_TESTNET],
          });
        } catch (addError) {
          console.error('Error adding chain:', addError);
        }
      } else {
        console.error('Error switching chain:', switchError);
      }
    }
  }, [provider]);

  useEffect(() => {
    if (!provider) return;

    updateAccount();

    const handleAccountsChanged = (...args: unknown[]) => {
      updateAccount();
    };

    const handleChainChanged = (...args: unknown[]) => {
      updateAccount();
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('chainChanged', handleChainChanged);
    };
  }, [provider, updateAccount]);

  return {
    ...state,
    connect,
    disconnect,
    switchChain,
    isCorrectChain: state.chainId === REQUIRED_CHAIN_ID,
  };
}