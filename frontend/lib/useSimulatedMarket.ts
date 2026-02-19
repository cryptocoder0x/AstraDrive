"use client";

import { useEffect, useState, useCallback } from "react";

export interface MarketData {
    timestamp: number;
    tvl: number;
    sharePrice: number;
    apy: number;
    asterAllocation: number;
    lpAllocation: number;
    priceDeviation: number;
    marketMode: "Normal" | "High Volatility" | "Drawdown";
    riskScore: number;
    volume24h: number;
}

export interface CandleData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// Simulated market engine that creates realistic volatility
export function useSimulatedMarket(baseData?: { tvl: number; sharePrice: number; apy: number }) {
    const [currentData, setCurrentData] = useState<MarketData>({
        timestamp: Date.now(),
        tvl: baseData?.tvl || 18.45,
        sharePrice: baseData?.sharePrice || 1.000123,
        apy: baseData?.apy || 12.5,
        asterAllocation: 70,
        lpAllocation: 30,
        priceDeviation: 1.2,
        marketMode: "Normal",
        riskScore: 15,
        volume24h: 1250.5,
    });

    const [history, setHistory] = useState<MarketData[]>([]);
    const [candles, setCandles] = useState<CandleData[]>([]);
    const [isActive, setIsActive] = useState(true);

    // Generate realistic market movement
    const generateNextTick = useCallback((prev: MarketData): MarketData => {
        const now = Date.now();
        const timeDelta = 1000; // 1 second updates

        // Simulate price volatility (Brownian motion with drift)
        const volatility = 0.002; // 0.2% volatility per tick
        const drift = 0.0001; // Slight upward drift
        const randomShock = (Math.random() - 0.5) * 2 * volatility;
        const priceChange = drift + randomShock;

        const newSharePrice = prev.sharePrice * (1 + priceChange);
        const priceDeviation = Math.abs(priceChange) * 100;

        // Determine market mode based on deviation
        let marketMode: "Normal" | "High Volatility" | "Drawdown" = "Normal";
        let asterAllocation = 70;
        let lpAllocation = 30;
        let riskScore = 15;

        if (priceDeviation > 8) {
            marketMode = "Drawdown";
            asterAllocation = 100;
            lpAllocation = 0;
            riskScore = 85 + Math.random() * 15;
        } else if (priceDeviation > 3) {
            marketMode = "High Volatility";
            asterAllocation = 85;
            lpAllocation = 15;
            riskScore = 50 + Math.random() * 30;
        } else {
            marketMode = "Normal";
            asterAllocation = 70;
            lpAllocation = 30;
            riskScore = 10 + Math.random() * 20;
        }

        // TVL changes based on market conditions and yield
        const tvlChange = (Math.random() - 0.48) * 0.5; // Slight growth bias
        const newTvl = Math.max(0.1, prev.tvl * (1 + tvlChange / 100));

        // APY fluctuates based on market mode
        const apyBase = marketMode === "Normal" ? 12 : marketMode === "High Volatility" ? 15 : 8;
        const apyNoise = (Math.random() - 0.5) * 4;
        const newApy = Math.max(0, apyBase + apyNoise);

        // Volume simulation
        const volumeChange = (Math.random() - 0.5) * 200;
        const newVolume = Math.max(100, prev.volume24h + volumeChange);

        return {
            timestamp: now,
            tvl: newTvl,
            sharePrice: newSharePrice,
            apy: newApy,
            asterAllocation,
            lpAllocation,
            priceDeviation: priceDeviation * 100, // Convert to bps
            marketMode,
            riskScore: Math.min(100, Math.max(0, riskScore)),
            volume24h: newVolume,
        };
    }, []);

    // Update candles every 5 seconds
    const updateCandles = useCallback((data: MarketData, prevCandles: CandleData[]) => {
        const candleInterval = 5000; // 5 second candles
        const lastCandle = prevCandles[prevCandles.length - 1];

        if (!lastCandle || data.timestamp - lastCandle.timestamp >= candleInterval) {
            // Create new candle
            const newCandle: CandleData = {
                timestamp: data.timestamp,
                open: data.sharePrice,
                high: data.sharePrice,
                low: data.sharePrice,
                close: data.sharePrice,
                volume: data.volume24h,
            };
            return [...prevCandles.slice(-50), newCandle]; // Keep last 50 candles
        } else {
            // Update current candle
            const updated = [...prevCandles];
            const current = updated[updated.length - 1];
            current.high = Math.max(current.high, data.sharePrice);
            current.low = Math.min(current.low, data.sharePrice);
            current.close = data.sharePrice;
            current.volume = data.volume24h;
            return updated;
        }
    }, []);

    // Simulation loop
    useEffect(() => {
        if (!isActive) return;

        const interval = setInterval(() => {
            setCurrentData((prev) => {
                const next = generateNextTick(prev);
                
                // Update history
                setHistory((h) => [...h.slice(-100), next]); // Keep last 100 points
                
                // Update candles
                setCandles((c) => updateCandles(next, c));
                
                return next;
            });
        }, 1000); // Update every second

        return () => clearInterval(interval);
    }, [isActive, generateNextTick, updateCandles]);

    return {
        currentData,
        history,
        candles,
        isActive,
        setIsActive,
    };
}
