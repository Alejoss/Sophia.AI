// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Interface for the StoreHashContract to interact with it
interface IStoreHashContract {
    function storeHash(bytes32 hash, string calldata ipfsCid, address user) external;
}

contract ChainlinkFunctionsInteraction is ChainlinkClient, Ownable {
    using Chainlink for Chainlink.Request;

    // Oracle and job specifications
    address private oracle;
    bytes32 private jobId;
    uint256 private fee;
    address private storeHashContract;

    // Event emitted when the request is fulfilled
    event RequestFulfilled(bytes32 indexed requestId, bytes32 indexed hash, string ipfsCid);

    // Constructor to initialize the contract
    constructor(address _oracle, bytes32 _jobId, uint256 _fee, address _linkToken, address _storeHashContract) {
        setChainlinkToken(_linkToken); // Set the LINK token for Chainlink interactions
        oracle = _oracle; // Set the Chainlink oracle address
        jobId = _jobId; // Set the job ID for the specific task
        fee = _fee; // Set the fee for the Chainlink request
        storeHashContract = _storeHashContract; // Set the StoreHashContract address
    }

    // Function to request hashing and verification of text from a URL
    function requestHash(string memory url) public returns (bytes32 requestId) {
        // Build Chainlink request
        Chainlink.Request memory request = buildChainlinkRequest(jobId, address(this), this.fulfill.selector);
        request.add("url", url); // Add URL to the request
        // Send the request to the oracle
        return sendChainlinkRequestTo(oracle, request, fee);
    }

    // Fulfillment function called by Chainlink when the request is fulfilled
    function fulfill(bytes32 _requestId, bytes32 _hash, string memory _ipfsCid) public recordChainlinkFulfillment(_requestId) {
        // Emit an event for the fulfilled request
        emit RequestFulfilled(_requestId, _hash, _ipfsCid);
        // Call the StoreHashContract to store the hash and IPFS CID
        IStoreHashContract(storeHashContract).storeHash(_hash, _ipfsCid, tx.origin);
    }
}
