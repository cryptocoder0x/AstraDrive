// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IAsterEarn.sol";

/// @title MockAsterEarn
/// @notice Mock implementation of AsterEarn for testing and BNB Testnet deployment
/// @dev Simulates yield by minting 0.1% rewards on each claimRewards() call
contract MockAsterEarn is IAsterEarn, ERC20 {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlying;
    uint256 private _totalAssets;
    uint256 private _totalShares;

    // Simulated APY: 0.1% per claimRewards() call
    uint256 public constant SIMULATED_YIELD_BPS = 10;

    mapping(address => uint256) public userShares;

    event Deposited(address indexed user, uint256 amount, uint256 shares);
    event Withdrawn(address indexed user, uint256 shares, uint256 amount);
    event RewardsClaimed(uint256 amount);

    constructor(address _underlying) ERC20("MockAsterEarn Share", "mASTER") {
        underlying = IERC20(_underlying);
    }

    function deposit(uint256 amount) external override {
        require(amount > 0, "MockAster: zero amount");
        underlying.safeTransferFrom(msg.sender, address(this), amount);

        uint256 shares;
        if (_totalShares == 0 || _totalAssets == 0) {
            shares = amount;
        } else {
            shares = (amount * _totalShares) / _totalAssets;
        }

        _totalAssets += amount;
        _totalShares += shares;
        userShares[msg.sender] += shares;
        _mint(msg.sender, shares);

        emit Deposited(msg.sender, amount, shares);
    }

    function withdraw(uint256 shares) external override {
        require(shares > 0, "MockAster: zero shares");
        require(userShares[msg.sender] >= shares, "MockAster: insufficient shares");

        uint256 amount = (shares * _totalAssets) / _totalShares;

        _totalShares -= shares;
        _totalAssets -= amount;
        userShares[msg.sender] -= shares;
        _burn(msg.sender, shares);

        underlying.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, shares, amount);
    }

    function claimRewards() external override {
        // Simulate yield: mint 0.1% of total assets as reward
        uint256 reward = (_totalAssets * SIMULATED_YIELD_BPS) / 10_000;
        if (reward > 0) {
            // In real AsterEarn, rewards come from protocol yield
            // Here we simulate by increasing totalAssets (as if yield was earned)
            _totalAssets += reward;
            emit RewardsClaimed(reward);
        }
    }

    function totalAssets() external view override returns (uint256) {
        return _totalAssets;
    }

    function totalShares() external view override returns (uint256) {
        return _totalShares;
    }
}
