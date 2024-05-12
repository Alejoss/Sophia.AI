// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./SophiaAIParams.sol";

/**
 * This is a trait for all the contracts making use of the
 * parameters contract, to properly charge-and-return users
 * (they should account for variance and spend more money
 * than the advertised in first place -- the remainder will
 * always be returned back).
 */
abstract contract SophiaAIParamsConsumer {
    SophiaAIParams private params;

    constructor(address _params) {
        require(_params != address(0), "SophiaAIParamsConsumer: Invalid params contract address");
        params = SophiaAIParams(_params);
    }

    /**
     * Modifies a method to charge an amount for its execution.
     * The paid money will go to the parameters contract, and
     * the remainder will be returned to the sender. The cost
     * is linear wrt the amount (no discounts are implemented).
     */
    modifier chargesAmount(bytes32 _param, uint256 amount) {
        uint256 paid = msg.value;
        uint256 cost = params.getNativeCost(_param) * amount;
        require(paid >= cost, "SophiaAIParamsConsumer: Insufficient payment");
        payable(address(params)).call{value: paid}("");
        payable(msg.sender).call{value: paid - cost}("");
        _;
    }

    /**
     * Gets the cost of a given feature, accounting for the amount
     * of units (the cost is linear wrt the amount; no discounts
     * are implemented).
     */
    function getNativeCost(bytes32 _param, uint256 amount) public view returns (uint256) {
        return params.getNativeCost(_param) * amount;
    }
}
