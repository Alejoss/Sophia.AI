// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21 <0.9.0;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * This is a DUMB price feed, which only has one round where
 * the price of the native token is $0.65. No more data is
 * being produced and this only makes sense while running
 * the contract in a local ganache.
 */
contract ChainLinkMaticUsdLocalMock is AggregatorV3Interface {
  function decimals() external view returns (uint8) {
    return 8;
  }

  function description() external view returns (string memory) {
    return "A mock to the MATIC/USD price feed that exists in Polygon Mainnet";
  }

  function version() external view returns (uint256) {
    return 1;
  }

  function getRoundData(
    uint80 _roundId
  ) external view returns (uint80, int256, uint256, uint256, uint80) {
    return (_roundId, 65000000, 1, 1, 1);
  }

  function latestRoundData()
  external
  view
  returns (uint80, int256, uint256, uint256, uint80) {
    return (1, 65000000, 1, 1, 1);
  }
}
