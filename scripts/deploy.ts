import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ─── BNB Testnet Known Addresses ─────────────────────────────────────────────
// PancakeSwap Router v2 on BSC Testnet
const PANCAKE_ROUTER = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
// PancakeSwap Factory on BSC Testnet
const PANCAKE_FACTORY = "0x6725F303b657a9451d8BA641348b6761A6CC7a17";
// WBNB on BSC Testnet
const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
// BUSD on BSC Testnet (use as primary token)
const BUSD_TESTNET = ethers.getAddress("0xC57BfAf8FB2BE3DC1dcd49dC53ED37951C587596".toLowerCase());

// ─── AsterDEX Earn (update after AsterDEX deploys on testnet) ────────────────
// If AsterDEX Earn is not yet deployed, we deploy a mock for testing
const ASTER_EARN_ADDRESS = "0x7d1216Ec906D61d697729D34D7a01965d2b8acb1";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("\n🚀 AstraDrive Deployment");
    console.log("========================");
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} tBNB`);
    console.log(`Network:  ${(await ethers.provider.getNetwork()).name} (chainId: ${(await ethers.provider.getNetwork()).chainId})`);
    console.log("");

    // ── Step 1: Deploy Mock AsterEarn if no real address provided ─────────────
    let asterEarnAddress = ASTER_EARN_ADDRESS;
    if (!asterEarnAddress) {
        console.log("⚠️  No ASTER_EARN_ADDRESS set. Deploying MockAsterEarn...");
        const MockAsterEarn = await ethers.getContractFactory("MockAsterEarn");
        const mockAster = await MockAsterEarn.deploy(BUSD_TESTNET);
        await mockAster.waitForDeployment();
        asterEarnAddress = await mockAster.getAddress();
        console.log(`✅ MockAsterEarn deployed: ${asterEarnAddress}`);
    } else {
        console.log(`✅ Using AsterEarn at: ${asterEarnAddress}`);
    }

    // ── Step 2: Get LP Pair address (BUSD/WBNB) ───────────────────────────────
    console.log("\n📍 Fetching PancakeSwap BUSD/WBNB pair...");
    const factoryABI = ["function getPair(address,address) view returns (address)"];
    const factory = new ethers.Contract(PANCAKE_FACTORY, factoryABI, deployer);
    let lpPairAddress = await factory.getPair(BUSD_TESTNET, WBNB);

    if (lpPairAddress === ethers.ZeroAddress) {
        lpPairAddress = "0xF5f5490B6DeA32456a661B00657Fc99A5427ECc5";
        console.log(`✅ Using existing MockPancakePair at: ${lpPairAddress}`);
    } else {
        console.log(`✅ LP Pair: ${lpPairAddress}`);
    }

    // ── Step 3: Deploy EngineCore (needs vault address – deploy placeholder first) ──
    // We use a 2-phase deploy: EngineCore needs vault, vault needs engineCore.
    // Solution: deploy EngineCore with a temporary address, then deploy vault,
    // then use an immutable-safe pattern via constructor ordering.
    //
    // Pattern: Deploy vault with engineCore address computed via CREATE2 or
    // deploy EngineCore first with a mock vault, then deploy real vault.
    // For simplicity: deploy EngineCore last (vault address known first).

    // ── Step 4: Deploy AstraVault ─────────────────────────────────────────────
    // We need engineCore address before deploying vault.
    // Use nonce-based address prediction.
    const nonce = await ethers.provider.getTransactionCount(deployer.address);
    // EngineCore will be deployed at nonce+3 (after StrategyRouter, AutoCompounder)
    const predictedEngineCoreAddress = ethers.getCreateAddress({
        from: deployer.address,
        nonce: nonce + 3,
    });
    console.log(`\n🔮 Predicted EngineCore address: ${predictedEngineCoreAddress}`);

    console.log("\n📦 Deploying AstraVault...");
    const AstraVault = await ethers.getContractFactory("AstraVault");
    const vault = await AstraVault.deploy(predictedEngineCoreAddress);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log(`✅ AstraVault deployed: ${vaultAddress}`);

    // ── Step 5: Deploy StrategyRouter ─────────────────────────────────────────
    console.log("\n📦 Deploying StrategyRouter...");
    const StrategyRouter = await ethers.getContractFactory("StrategyRouter");
    const strategyRouter = await StrategyRouter.deploy(
        asterEarnAddress,
        PANCAKE_ROUTER,
        lpPairAddress,
        WBNB,
        predictedEngineCoreAddress
    );
    await strategyRouter.waitForDeployment();
    const strategyRouterAddress = await strategyRouter.getAddress();
    console.log(`✅ StrategyRouter deployed: ${strategyRouterAddress}`);

    // ── Step 6: Deploy AutoCompounder ─────────────────────────────────────────
    console.log("\n📦 Deploying AutoCompounder...");
    const AutoCompounder = await ethers.getContractFactory("AutoCompounder");
    const autoCompounder = await AutoCompounder.deploy(
        asterEarnAddress,
        PANCAKE_ROUTER,
        lpPairAddress,
        WBNB,
        predictedEngineCoreAddress,
        vaultAddress
    );
    await autoCompounder.waitForDeployment();
    const autoCompounderAddress = await autoCompounder.getAddress();
    console.log(`✅ AutoCompounder deployed: ${autoCompounderAddress}`);

    // ── Step 7: Deploy EngineCore ─────────────────────────────────────────────
    console.log("\n📦 Deploying EngineCore...");
    const EngineCore = await ethers.getContractFactory("EngineCore");
    const engineCore = await EngineCore.deploy(
        vaultAddress,
        strategyRouterAddress,
        autoCompounderAddress,
        asterEarnAddress,
        lpPairAddress
    );
    await engineCore.waitForDeployment();
    const engineCoreAddress = await engineCore.getAddress();
    console.log(`✅ EngineCore deployed: ${engineCoreAddress}`);

    // Verify address prediction was correct
    if (engineCoreAddress.toLowerCase() !== predictedEngineCoreAddress.toLowerCase()) {
        console.warn(`⚠️  EngineCore address mismatch!`);
        console.warn(`   Predicted: ${predictedEngineCoreAddress}`);
        console.warn(`   Actual:    ${engineCoreAddress}`);
        console.warn(`   Vault and routers have wrong engineCore. Redeploy needed.`);
    } else {
        console.log(`✅ Address prediction correct!`);
    }

    // ── Step 8: Save deployment addresses ─────────────────────────────────────
    const deployment = {
        network: "bscTestnet",
        chainId: 97,
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            AstraVault: vaultAddress,
            StrategyRouter: strategyRouterAddress,
            AutoCompounder: autoCompounderAddress,
            EngineCore: engineCoreAddress,
            MockAsterEarn: asterEarnAddress,
        },
        externalAddresses: {
            PancakeRouter: PANCAKE_ROUTER,
            PancakeFactory: PANCAKE_FACTORY,
            WBNB,
            BUSD: BUSD_TESTNET,
            LPPair: lpPairAddress,
        },
    };

    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    const deploymentPath = path.join(deploymentsDir, "bscTestnet.json");
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

    console.log("\n🎉 Deployment Complete!");
    console.log("========================");
    console.log(`AstraVault:      ${vaultAddress}`);
    console.log(`StrategyRouter:  ${strategyRouterAddress}`);
    console.log(`AutoCompounder:  ${autoCompounderAddress}`);
    console.log(`EngineCore:      ${engineCoreAddress}`);
    console.log(`\n📄 Saved to: ${deploymentPath}`);
    console.log(`\n🔍 Verify on BscScan: https://testnet.bscscan.com/address/${vaultAddress}`);
    console.log(`\n⚡ Next: Update frontend/src/lib/contracts.ts with these addresses`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
