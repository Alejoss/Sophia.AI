/** mempool.space explorer URLs by TranscriptAnchor.btc_network */
export const BTC_EXPLORER_URL = {
  mainnet: (txid) => `https://mempool.space/tx/${txid}`,
  testnet: (txid) => `https://mempool.space/testnet/tx/${txid}`,
  testnet4: (txid) => `https://mempool.space/testnet4/tx/${txid}`,
  signet: (txid) => `https://mempool.space/signet/tx/${txid}`,
};

/**
 * @param {string|null|undefined} txid
 * @param {string|null|undefined} network
 * @returns {string|null}
 */
export function getBtcExplorerTxUrl(txid, network) {
  if (!txid) return null;
  const builder = BTC_EXPLORER_URL[network] || BTC_EXPLORER_URL.signet;
  return builder(txid);
}
