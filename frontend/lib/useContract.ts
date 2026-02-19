"use client";

import { useState, useEffect } from 'react';
import { readContract, writeContract, waitForTransaction } from './contractUtils';
import { useMetaMask } from './useMetaMask';

export function useReadContract({
  contractAddress,
  abi,
  functionName,
  params = [],
  enabled = true
}: {
  contractAddress: string;
  abi: readonly string[] | any[];
  functionName: string;
  params?: any[];
  enabled?: boolean;
}) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { isConnected, isCorrectChain } = useMetaMask();

  useEffect(() => {
    if (!enabled || !isConnected || !isCorrectChain) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await readContract({
          contractAddress,
          abi,
          functionName,
          params
        });
        setData(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [contractAddress, functionName, JSON.stringify(params), enabled, isConnected, isCorrectChain]);

  return { data, isLoading, error };
}

export function useWriteContract() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const writeContractAsync = async ({
    contractAddress,
    abi,
    functionName,
    params = [],
    value = '0x0'
  }: {
    contractAddress: string;
    abi: readonly string[] | any[];
    functionName: string;
    params?: any[];
    value?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      const hash = await writeContract({
        contractAddress,
        abi,
        functionName,
        params,
        value
      });
      setTxHash(hash);
      return hash;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    writeContractAsync,
    isLoading,
    error,
    txHash
  };
}

export function useWaitForTransaction(txHash: string | null) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!txHash) return;

    const waitForTx = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const receipt = await waitForTransaction(txHash);
        setData(receipt);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    waitForTx();
  }, [txHash]);

  return { data, isLoading, error };
}