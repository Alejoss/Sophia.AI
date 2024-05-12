// SPDX-License-Identifier: MIT
pragma solidity >=0.8.21 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * Manages all the underlying parameters of our Sophia AI
 * ecosystem. This includes ownership, costs, and withdrawal.
 */
contract SophiaAIParams is Ownable {
  /**
   * The scale factor between polygon price feeds and USD
   * cents. The scale of 24 is used because the conversion
   * rate is adjusted like this:
   *
   * EVM_SCALE / (DOLLAR_SCALE / USD_PER_MATIC_SCALE)
   *
   * The EVM_SCALE is the actual internal size of 1 full
   * EVM token (which is 10**18 of the minimum units, which
   * are called "wei").
   *
   * The DOLLAR_SCALE is 100 (10**2) because the prices are
   * expressed in cents in our code.
   *
   * The USD_PER_MATIC_SCALE is given by the feed. 1 FULL
   * MATIC has a cost (expressed in USD) that is expressed
   * by scaling it 8 positions. For example: 50000000 means
   * $0.50 per MATIC, while 125000000 means $1.25 per matic.
   *
   * So the idea here is: "Add the EVM scale (to properly tell
   * the EVM-scaled value to 'wei' units) while removing the
   * rate conversion scale", which in turn was previously got
   * by: "Add the dollar scale (100 for the cents) while also
   * removing the USD_PER_MATIC scale (100000000)".
   *
   * The math results in: 10**18 / (10**2 / 10**8) or 10**(16 + 8).
   * The feed scale we'll be provided by the feed itself.
   */
  uint256 private constant MaticFromCentsScaleFactor = 10 ** 16;

  /**
   * The address that will receive the collected earnings.
   * Ideally, it should be a user address (it is not allowed
   * for it to be the zero address), but it can be a contract
   * address instead (specially if the receiving contract has
   * some sort of "split" logic on it).
   */
  address public earningsReceiver;

  /**
   * The registered fiat costs. A fiat cost of 0 should not be used,
   * since that value is used to tell an element does not exist.
   */
  mapping(bytes32 => uint256) public fiatCosts;

  /**
   * The address of the price feed interface.
   */
  address private priceFeed;

  /**
   * Initialization involves the following arguments:
   * 1. The earnings receiver will be the sender itself.
   * 2. The price feed will be specified here. IT MUST
   *    BE A CONTRACT ADDRESS SUPPORTING AggregatorV3Interface.
   *
   * We'll be using Polygon here, and the MATIC/USD feed inside
   * the same network (MATIC mainnet) is:
   * 0xAB594600376Ec9fD91F8e885dADF0CE036862dE0.
   *
   * We'll MOCK the contract when using truffle, fixing a value.
   */
  constructor(address _priceFeed) Ownable(msg.sender) {
    earningsReceiver = msg.sender;
    priceFeed = _priceFeed;
  }

  /**
   * Sets a new fiat cost (expressed in USD cents).
   */
  function setFiatCost(bytes32 _key, uint256 _value) public onlyOwner {
    fiatCosts[_key] = _value;
  }

  /**
   * Sets the new earnings receiver address. This action is only
   * allowed to the owner of the contract.
   */
  function setEarningsReceiver(address _earningsReceiver) public onlyOwner {
    require(_earningsReceiver != address(0), "SophiaAIParams: Invalid receiver");
    earningsReceiver = _earningsReceiver;
  }

  /**
   * Withdraws a specific amount.
   */
  function earningsWithdraw(uint256 _amount) public onlyOwner {
    uint256 earningsBalance = address(this).balance;
    require(_amount <= address(this).balance, "StickEmAllParams: Insufficient funds");
    payable(earningsReceiver).call{value: _amount}("");
  }

  receive() {
    // Nothing to do here.
  }

  /**
   * Tells the native cost (this means: in tokens) of a given parameter.
   */
  function getNativeCost(bytes32 _key) public view returns (uint256) {
    // Please note: DO NOT REMOVE PARENTHESES, COMMENTS, OR COMMAS.
    //              THE COMMAS ARE NEEDED SINCE THE latestRoundData
    //              METHOD RETURNS A TUPLE OF 5 ELEMENTS, WHICH ARE
    //              DELIMITED BY THE COMMAS. It happens we'll ignore
    //              the other fields, but the "place" for them must
    //              remain (and same for the parentheses).
    (
      /* uint80 roundID */,
      int currentPrice,
      /*uint startedAt*/,
      /*uint timeStamp*/,
      /*uint80 answeredInRound*/
    ) = AggregatorV3Interface(priceFeed).latestRoundData();

    // Getting the per-feed decimals.
    uint8 decimals = AggregatorV3Interface(priceFeed).decimals();

    // Now, we take this value and use it properly as a factor.
    // We'll be using Polygon here. The rate is expressed in units
    // of 10**8 (e.g. 50000000 means $0.50/MATIC).
    uint256 rate = uint256(currentPrice);

    // The fiat cost is expressed in units of 10**2 (e.g. 250 means
    // a price of $2.50).
    uint256 fiatCost = fiatCosts[_key];

    // This means that the final conversion will be:
    // 1e18 * ((fiatCost / 100) / (rate / 10**8))
    //
    // Which is the same as: 10 ** (18 - 2 + 8), or 10 ** 24
    return MaticFromCentsScaleFactor * (10 ** decimals) * fiatCost / rate;
  }
}
