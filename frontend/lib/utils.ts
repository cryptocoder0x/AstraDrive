import { formatUnits } from "./contractUtils";

export function formatAmount(value: bigint, decimals = 18, displayDecimals = 4): string {
    const formatted = formatUnits(value, decimals);
    const num = parseFloat(formatted);
    if (num === 0) return "0.00";
    if (num < 0.0001) return "< 0.0001";
    return num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: displayDecimals,
    });
}

export function formatAPY(apyBps: bigint): string {
    const apy = Number(apyBps) / 100;
    return `${apy.toFixed(2)}%`;
}

export function formatUSD(value: bigint, decimals = 18): string {
    const num = parseFloat(formatUnits(value, decimals));
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
}

export function formatPercent(bps: bigint): string {
    return `${(Number(bps) / 100).toFixed(1)}%`;
}

export function formatSharePrice(price: bigint): string {
    const num = parseFloat(formatUnits(price, 18));
    return num.toFixed(6);
}

export function shortenAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTimeRemaining(seconds: bigint): string {
    const s = Number(seconds);
    if (s <= 0) return "Ready";
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}
