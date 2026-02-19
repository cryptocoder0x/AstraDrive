"use client";

import { WalletBar } from "@/components/WalletBar";
import { ChainGuard } from "@/components/ChainGuard";
import { HybridDashboard } from "@/components/HybridDashboard";
import { DepositWithdraw } from "@/components/DepositWithdraw";
import { UserPosition } from "@/components/UserPosition";
import { TransactionChecker } from "@/components/TransactionChecker";
import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES, ENGINECORE_ABI } from "@/lib/contracts";

export default function Home() {
  const engineAddr = CONTRACT_ADDRESSES.EngineCore as `0x${string}`;
  const { data: canExecute } = useReadContract({
    address: engineAddr,
    abi: ENGINECORE_ABI,
    functionName: "canExecuteCycle",
  });

  return (
    <div className="min-h-screen bg-[#080B14]">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-yellow-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-purple-600/8 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-lg font-bold text-black">
              ⚡
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">AstraDrive</h1>
              <p className="text-xs text-gray-400">Autonomous Yield Engine · BNB Testnet</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Cycle indicator */}
            {canExecute !== undefined && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${canExecute
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-white/5 text-gray-400 border border-white/10"
                }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${canExecute ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
                {canExecute ? "Cycle Ready" : "Engine Running"}
              </div>
            )}
            <WalletBar />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3 pb-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs font-semibold">
            🚀 Self-Driving · Non-Custodial · No Admin Keys
          </div>
          <h2 className="text-4xl font-bold text-white">
            Your Capital,{" "}
            <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              Autonomously Optimized
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-sm leading-relaxed">
            AstraDrive automatically routes your capital between AsterDEX Earn and PancakeSwap LP,
            rebalancing on-chain based on real-time volatility — with zero human intervention.
          </p>
        </div>

        {/* Chain guard wraps everything that needs correct network */}
        <ChainGuard>
          {/* Hybrid Dashboard - Real blockchain data + Simulated market */}
          <HybridDashboard />

          {/* Action + Position */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DepositWithdraw />
            <UserPosition />
          </div>

          {/* Protocol Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoCard
              icon="🤖"
              title="Fully Autonomous"
              desc="executeCycle() is callable by anyone. No admin, no multisig, no off-chain bots required."
            />
            <InfoCard
              icon="🔒"
              title="Non-Custodial"
              desc="ERC4626 vault. You hold ASTRA shares. Contracts are immutable — no proxy, no upgrade."
            />
            <InfoCard
              icon="📊"
              title="Intelligent Allocation"
              desc="On-chain volatility detection shifts capital: 70/30 Normal → 85/15 High Vol → 100/0 Drawdown."
            />
          </div>

          {/* Strategy Modes */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-5">
              Autonomous Strategy Modes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ModeCard
                mode="Normal Market"
                color="green"
                aster="70%"
                lp="30%"
                trigger="Price deviation &lt; 3%"
                desc="Balanced yield from Aster + LP fees"
              />
              <ModeCard
                mode="High Volatility"
                color="yellow"
                aster="85%"
                lp="15%"
                trigger="Price deviation 3–8%"
                desc="Reduce LP exposure, protect capital"
              />
              <ModeCard
                mode="Drawdown"
                color="red"
                aster="100%"
                lp="0%"
                trigger="Price deviation &gt; 8%"
                desc="Full capital preservation in Aster"
              />
            </div>
          </div>
        </ChainGuard>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div>AstraDrive · Autonomous Yield Engine · BNB Chain Testnet</div>
          <div className="flex items-center gap-4">
            <a href="https://testnet.bscscan.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">BscScan</a>
            <span>·</span>
            <span>Chain ID: 97</span>
            <span>·</span>
            <span>No admin keys · No proxy · Immutable</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function InfoCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-2">
      <div className="text-2xl">{icon}</div>
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="text-xs text-gray-400 leading-relaxed">{desc}</div>
    </div>
  );
}

function ModeCard({
  mode, color, aster, lp, trigger, desc,
}: {
  mode: string; color: "green" | "yellow" | "red"; aster: string; lp: string; trigger: string; desc: string;
}) {
  const colors = {
    green: "border-green-500/20 bg-green-500/5",
    yellow: "border-yellow-500/20 bg-yellow-500/5",
    red: "border-red-500/20 bg-red-500/5",
  };
  const textColors = {
    green: "text-green-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
  };
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${colors[color]}`}>
      <div className={`text-sm font-bold ${textColors[color]}`}>{mode}</div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">AsterDEX Earn</span>
          <span className="font-mono text-white">{aster}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">PancakeSwap LP</span>
          <span className="font-mono text-white">{lp}</span>
        </div>
      </div>
      <div className={`text-xs font-mono ${textColors[color]} opacity-70`}>{trigger}</div>
      <div className="text-xs text-gray-500">{desc}</div>
    </div>
  );
}
