// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TextHashContract is Ownable {
    IERC20 public token;
    uint256 public rewardAmount;

    mapping(bytes32 => bool) public storedHashes;
    mapping(bytes32 => address) public hashToUser;
    mapping(address => bytes32[]) public userToHashes;

    event HashStored(bytes32 indexed hash, address indexed user);

    constructor(IERC20 _token, uint256 _rewardAmount, address initialOwner) Ownable(initialOwner) {
        token = _token;
        rewardAmount = _rewardAmount;
    }

    function storeHash(bytes32 hash) public {
        require(!storedHashes[hash], "Hash already stored");

        storedHashes[hash] = true;
        hashToUser[hash] = msg.sender;
        userToHashes[msg.sender].push(hash);
        emit HashStored(hash, msg.sender);

        token.transfer(msg.sender, rewardAmount);
    }

    function setRewardAmount(uint256 _rewardAmount) public onlyOwner {
        rewardAmount = _rewardAmount;
    }

    function isHashStored(bytes32 hash) public view returns (bool) {
        return storedHashes[hash];
    }

    function getUserByHash(bytes32 hash) public view returns (address) {
        require(storedHashes[hash], "Hash not stored");
        return hashToUser[hash];
    }

    function getHashesByUser(address user) public view returns (bytes32[] memory) {
        return userToHashes[user];
    }

    function getMyHashes() public view returns (bytes32[] memory) {
        return userToHashes[msg.sender];
    }
}
