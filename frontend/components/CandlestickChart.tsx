"use client";

import { useEffect, useRef } from "react";
import { CandleData } from "@/lib/useSimulatedMarket";

interface CandlestickChartProps {
    candles: CandleData[];
    height?: number;
}

export function CandlestickChart({ candles, height = 200 }: CandlestickChartProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current || candles.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Set canvas size
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const h = rect.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, h);

        // Calculate price range
        const prices = candles.flatMap((c) => [c.high, c.low]);
        const maxPrice = Math.max(...prices);
        const minPrice = Math.min(...prices);
        const priceRange = maxPrice - minPrice || 1;
        const padding = priceRange * 0.1;

        // Draw grid
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = (h / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw candles
        const candleWidth = Math.max(2, width / candles.length - 2);
        const spacing = width / candles.length;

        candles.forEach((candle, i) => {
            const x = i * spacing + spacing / 2;

            // Normalize prices to canvas height
            const normalize = (price: number) => {
                return h - ((price - minPrice + padding) / (priceRange + 2 * padding)) * h;
            };

            const openY = normalize(candle.open);
            const closeY = normalize(candle.close);
            const highY = normalize(candle.high);
            const lowY = normalize(candle.low);

            const isGreen = candle.close >= candle.open;
            const color = isGreen ? "rgba(34, 197, 94, 0.8)" : "rgba(239, 68, 68, 0.8)";
            const wickColor = isGreen ? "rgba(34, 197, 94, 0.6)" : "rgba(239, 68, 68, 0.6)";

            // Draw wick
            ctx.strokeStyle = wickColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, highY);
            ctx.lineTo(x, lowY);
            ctx.stroke();

            // Draw body
            ctx.fillStyle = color;
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.abs(closeY - openY) || 1;
            ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
        });

        // Draw price labels
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "10px monospace";
        ctx.textAlign = "right";
        for (let i = 0; i <= 4; i++) {
            const price = maxPrice - (priceRange / 4) * i;
            const y = (h / 4) * i;
            ctx.fillText(`$${price.toFixed(6)}`, width - 5, y + 12);
        }

        // Draw current price line
        const currentPrice = candles[candles.length - 1]?.close;
        if (currentPrice) {
            // Normalize function for current price
            const normalizePrice = (price: number) => {
                return h - ((price - minPrice + padding) / (priceRange + 2 * padding)) * h;
            };
            
            const currentY = normalizePrice(currentPrice);
            ctx.strokeStyle = "rgba(250, 204, 21, 0.8)";
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(0, currentY);
            ctx.lineTo(width, currentY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Current price label
            ctx.fillStyle = "rgba(250, 204, 21, 1)";
            ctx.fillRect(width - 80, currentY - 10, 75, 18);
            ctx.fillStyle = "rgba(0, 0, 0, 1)";
            ctx.font = "bold 11px monospace";
            ctx.textAlign = "right";
            ctx.fillText(`$${currentPrice.toFixed(6)}`, width - 5, currentY + 3);
        }
    }, [candles, height]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: "100%", height: `${height}px` }}
            className="rounded-lg"
        />
    );
}
