import { expect } from "chai";
import { ethers } from "hardhat";
import { EngineCore } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("EngineCore", function () {
    let engineCore: EngineCore;
    let mockVault: any;
    let mockRouter: any;
    let mockCompounder: any;
    let mockAster: any;
    let mockPair: any;
    let owner: SignerWithAddress;
    let anyone: SignerWithAddress;

    beforeEach(async function () {
        [owner, anyone] = await ethers.getSigners();

        // Deploy mock BUSD
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const busd = await MockERC20.deploy("BUSD", "BUSD", ethers.parseEther("1000000"));

        // Deploy MockAsterEarn
        const MockAster = await ethers.getContractFactory("MockAsterEarn");
        mockAster = await MockAster.deploy(await busd.getAddress());

        // Deploy MockPancakePair
        const MockPair = await ethers.getContractFactory("MockPancakePair");
        mockPair = await MockPair.deploy();

        // Deploy MockVault (simple contract that accepts recordHarvest)
        const MockVault = await ethers.getContractFactory("MockVaultForEngine");
        mockVault = await MockVault.deploy();

        // Deploy MockStrategyRouter
        const MockRouter = await ethers.getContractFactory("MockStrategyRouter");
        mockRouter = await MockRouter.deploy();

        // Deploy MockAutoCompounder
        const MockCompounder = await ethers.getContractFactory("MockAutoCompounder");
        mockCompounder = await MockCompounder.deploy();

        // Deploy EngineCore
        const EngineCoreFactory = await ethers.getContractFactory("EngineCore");
        engineCore = await EngineCoreFactory.deploy(
            await mockVault.getAddress(),
            await mockRouter.getAddress(),
            await mockCompounder.getAddress(),
            await mockAster.getAddress(),
            await mockPair.getAddress()
        );
    });

    describe("Deployment", function () {
        it("Should have correct immutable addresses", async function () {
            expect(await engineCore.vault()).to.equal(await mockVault.getAddress());
            expect(await engineCore.strategyRouter()).to.equal(await mockRouter.getAddress());
            expect(await engineCore.autoCompounder()).to.equal(await mockCompounder.getAddress());
        });

        it("Should start with zero cycles executed", async function () {
            expect(await engineCore.totalCyclesExecuted()).to.equal(0);
        });
    });

    describe("Cycle Execution", function () {
        it("Should revert if cooldown not elapsed", async function () {
            await expect(engineCore.connect(anyone).executeCycle()).to.be.revertedWith(
                "EC: cooldown active"
            );
        });

        it("Should allow cycle after CYCLE_INTERVAL", async function () {
            await time.increase(3601); // 1 hour + 1 second
            await expect(engineCore.connect(anyone).executeCycle()).to.not.be.reverted;
        });

        it("Should increment cycle counter", async function () {
            await time.increase(3601);
            await engineCore.connect(anyone).executeCycle();
            expect(await engineCore.totalCyclesExecuted()).to.equal(1);
        });

        it("Should be callable by anyone (no privileged role)", async function () {
            await time.increase(3601);
            // Called by 'anyone' signer, not owner
            await expect(engineCore.connect(anyone).executeCycle()).to.not.be.reverted;
        });

        it("Should enforce cooldown between cycles", async function () {
            await time.increase(3601);
            await engineCore.connect(anyone).executeCycle();

            // Immediately try again - should fail
            await expect(engineCore.connect(anyone).executeCycle()).to.be.revertedWith(
                "EC: cooldown active"
            );
        });

        it("Should allow second cycle after another interval", async function () {
            await time.increase(3601);
            await engineCore.connect(anyone).executeCycle();

            await time.increase(3601);
            await engineCore.connect(anyone).executeCycle();

            expect(await engineCore.totalCyclesExecuted()).to.equal(2);
        });
    });

    describe("Cycle Timing", function () {
        it("canExecuteCycle should return false initially", async function () {
            expect(await engineCore.canExecuteCycle()).to.equal(false);
        });

        it("canExecuteCycle should return true after interval", async function () {
            await time.increase(3601);
            expect(await engineCore.canExecuteCycle()).to.equal(true);
        });

        it("timeUntilNextCycle should decrease over time", async function () {
            const t1 = await engineCore.timeUntilNextCycle();
            await time.increase(100);
            const t2 = await engineCore.timeUntilNextCycle();
            expect(t2).to.be.lt(t1);
        });

        it("timeUntilNextCycle should return 0 when ready", async function () {
            await time.increase(3601);
            expect(await engineCore.timeUntilNextCycle()).to.equal(0);
        });
    });

    describe("Market Mode", function () {
        it("Should return NORMAL mode initially", async function () {
            const mode = await engineCore.currentMarketMode();
            expect(mode).to.equal(0); // MarketMode.NORMAL = 0
        });

        it("Should return risk score 0 with no price change", async function () {
            expect(await engineCore.currentRiskScore()).to.equal(0);
        });
    });
});
