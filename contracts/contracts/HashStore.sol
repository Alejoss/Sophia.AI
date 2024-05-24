// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TextHashContract is Ownable {
    IERC20 public token;
    uint256 public rewardAmount;

    mapping(bytes32 => bool) public storedHashes; // is the hash already stored
    mapping(bytes32 => address) public hashToUser; // which user has stored which hash
    mapping(address => bytes32[]) public userToHashes; // which hashes has stored the user

    event HashStored(bytes32 indexed hash, address indexed user); // indexed helps query events efficiently

    constructor(IERC20 _token, uint256 _rewardAmount, address initialOwner) Ownable(initialOwner) {// constructor executes when the contract is deployed
        token = _token; // IERC20 interface points to ERC20 token address
        rewardAmount = _rewardAmount; // How many tokens a user will receive for saving a hash
        }

    function storeHash(bytes32 hash) public { // hash is stored as bytes 32, a fixed size type that does not require memory type declaration
        require(!storedHashes[hash], "Hash already stored"); // checks if hash is already stored
        storedHashes[hash] = true;  // keeps record of which hash is stored
        hashToUser[hash] = msg.sender; // saves the address that stored the hash
        userToHashes[msg.sender].push(hash); // saves the hash to the array of hashes linked to the user
        emit HashStored(hash, msg.sender); // emits an event with the hash and the address of the user
        token.transfer(msg.sender, rewardAmount); // sends the token from the balance of this contract to the user that stored the hash
    }

    function setRewardAmount(uint256 _rewardAmount) public onlyOwner { // is public and changes data
            rewardAmount = _rewardAmount; // changes the reward amount for saving a hash
        }

    function isHashStored(bytes32 hash) public view returns (bool) {// is public but does not change date
        return storedHashes[hash];  // true if the hash is stored
    }

    function getUserByHash(bytes32 hash) public view returns (address) {
        require(storedHashes[hash], "Hash not stored");
        return hashToUser[hash]; // returns the address that saved the hash
    }

    function getHashesByUser(address user) public view returns (bytes32[] memory) {  // an array in a function parameter needs a data allocation type, here its memory
        return userToHashes[user];
    }

    function getMyHashes() public view returns (bytes32[] memory) {
        return userToHashes[msg.sender]; // returns the hashes stored by an address
        }
    }
