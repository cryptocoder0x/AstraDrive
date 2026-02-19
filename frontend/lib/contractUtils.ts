"use client";

import { getProvider } from './metamaskConfig';

export interface ContractCallParams {
  contractAddress: string;
  abi: readonly string[] | any[];
  functionName: string;
  params?: any[];
  value?: string;
}

export async function readContract({
  contractAddress,
  abi,
  functionName,
  params = []
}: Omit<ContractCallParams, 'value'>) {
  const provider = getProvider();
  if (!provider) throw new Error('MetaMask not available');

  // Handle human-readable ABI (array of strings)
  const abiArray = Array.isArray(abi) ? abi : [abi];
  const functionSig = abiArray.find((item: any) => 
    typeof item === 'string' && item.includes(`function ${functionName}`)
  );
  
  if (!functionSig) throw new Error(`Function ${functionName} not found in ABI`);

  // Parse human-readable ABI string
  const match = (functionSig as string).match(/function\s+(\w+)\((.*?)\)/);
  if (!match) throw new Error(`Invalid ABI format for ${functionName}`);
  
  const paramTypes = match[2] ? match[2].split(',').map(p => p.trim().split(' ')[0]) : [];
  
  // Encode function call
  const functionSignature = `${functionName}(${paramTypes.join(',')})`;
  const functionSelector = await provider.request({
    method: 'web3_sha3',
    params: [functionSignature]
  }) as string;

  let data = functionSelector.slice(0, 10); // First 4 bytes

  // Encode parameters (simplified - for production use a proper ABI encoder)
  if (params.length > 0) {
    // This is a simplified encoding - for production, use ethers or web3 ABI encoding
    const encodedParams = params.map(param => {
      if (typeof param === 'string' && param.startsWith('0x')) {
        return param.slice(2).padStart(64, '0');
      }
      if (typeof param === 'number' || typeof param === 'bigint') {
        return param.toString(16).padStart(64, '0');
      }
      return param.toString().padStart(64, '0');
    }).join('');
    data += encodedParams;
  }

  const result = await provider.request({
    method: 'eth_call',
    params: [{
      to: contractAddress,
      data: data
    }, 'latest']
  }) as string;

  return result;
}

export async function writeContract({
  contractAddress,
  abi,
  functionName,
  params = [],
  value = '0x0'
}: ContractCallParams) {
  const provider = getProvider();
  if (!provider) throw new Error('MetaMask not available');

  const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
  if (accounts.length === 0) throw new Error('No account connected');

  // Handle human-readable ABI (array of strings)
  const abiArray = Array.isArray(abi) ? abi : [abi];
  const functionSig = abiArray.find((item: any) => 
    typeof item === 'string' && item.includes(`function ${functionName}`)
  );
  
  if (!functionSig) throw new Error(`Function ${functionName} not found in ABI`);

  // Parse human-readable ABI string
  const match = (functionSig as string).match(/function\s+(\w+)\((.*?)\)/);
  if (!match) throw new Error(`Invalid ABI format for ${functionName}`);
  
  const paramTypes = match[2] ? match[2].split(',').map(p => p.trim().split(' ')[0]) : [];

  // Encode function call
  const functionSignature = `${functionName}(${paramTypes.join(',')})`;
  const functionSelector = await provider.request({
    method: 'web3_sha3',
    params: [functionSignature]
  }) as string;

  let data = functionSelector.slice(0, 10); // First 4 bytes

  // Encode parameters (simplified - for production use a proper ABI encoder)
  if (params.length > 0) {
    const encodedParams = params.map(param => {
      if (typeof param === 'string' && param.startsWith('0x')) {
        return param.slice(2).padStart(64, '0');
      }
      if (typeof param === 'number' || typeof param === 'bigint') {
        return param.toString(16).padStart(64, '0');
      }
      return param.toString().padStart(64, '0');
    }).join('');
    data += encodedParams;
  }

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from: accounts[0],
      to: contractAddress,
      data: data,
      value: value
    }]
  }) as string;

  return txHash;
}

export async function waitForTransaction(txHash: string) {
  const provider = getProvider();
  if (!provider) throw new Error('MetaMask not available');

  let receipt = null;
  while (!receipt) {
    try {
      receipt = await provider.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash]
      });
      if (!receipt) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return receipt;
}

// Utility functions for formatting
export function formatUnits(value: string | bigint, decimals = 18): string {
  const valueStr = typeof value === 'bigint' ? value.toString() : value.replace('0x', '');
  const valueBigInt = BigInt(valueStr.startsWith('0x') ? valueStr : '0x' + valueStr);
  const divisor = BigInt(10 ** decimals);
  const quotient = valueBigInt / divisor;
  const remainder = valueBigInt % divisor;
  
  if (remainder === 0n) {
    return quotient.toString();
  }
  
  const remainderStr = remainder.toString().padStart(decimals, '0');
  const trimmedRemainder = remainderStr.replace(/0+$/, '');
  
  return trimmedRemainder ? `${quotient}.${trimmedRemainder}` : quotient.toString();
}

export function parseUnits(value: string, decimals = 18): bigint {
  const [integer, fraction = ''] = value.split('.');
  const fractionPadded = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(integer + fractionPadded);
}