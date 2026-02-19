import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const deploymentPath = path.join(__dirname, "../deployments/bscTestnet.json");
    if (!fs.existsSync(deploymentPath)) {
        throw new Error("No deployment found. Run deploy.ts first.");
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const { contracts, externalAddresses } = deployment;

    console.log("🔍 Verifying contracts on BscScan Testnet...\n");

    // Verify AstraVault
    try {
        await run("verify:verify", {
            address: contracts.AstraVault,
            constructorArguments: [
                externalAddresses.BUSD,
                contracts.EngineCore,
            ],
        });
        console.log("✅ AstraVault verified");
    } catch (e: any) {
        console.log(`⚠️  AstraVault: ${e.message}`);
    }

    // Verify StrategyRouter
    try {
        await run("verify:verify", {
            address: contracts.StrategyRouter,
            constructorArguments: [
                contracts.MockAsterEarn,
                externalAddresses.PancakeRouter,
                externalAddresses.LPPair,
                externalAddresses.BUSD,
                externalAddresses.WBNB,
                contracts.EngineCore,
            ],
        });
        console.log("✅ StrategyRouter verified");
    } catch (e: any) {
        console.log(`⚠️  StrategyRouter: ${e.message}`);
    }

    // Verify AutoCompounder
    try {
        await run("verify:verify", {
            address: contracts.AutoCompounder,
            constructorArguments: [
                contracts.MockAsterEarn,
                externalAddresses.PancakeRouter,
                externalAddresses.LPPair,
                externalAddresses.BUSD,
                externalAddresses.BUSD,
                externalAddresses.WBNB,
                contracts.EngineCore,
                contracts.AstraVault,
            ],
        });
        console.log("✅ AutoCompounder verified");
    } catch (e: any) {
        console.log(`⚠️  AutoCompounder: ${e.message}`);
    }

    // Verify EngineCore
    try {
        await run("verify:verify", {
            address: contracts.EngineCore,
            constructorArguments: [
                contracts.AstraVault,
                contracts.StrategyRouter,
                contracts.AutoCompounder,
                contracts.MockAsterEarn,
                externalAddresses.LPPair,
            ],
        });
        console.log("✅ EngineCore verified");
    } catch (e: any) {
        console.log(`⚠️  EngineCore: ${e.message}`);
    }

    console.log("\n🎉 Verification complete!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
