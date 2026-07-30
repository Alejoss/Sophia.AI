import { describe, it, expect } from 'vitest';
import { getBtcExplorerTxUrl } from '../bitcoinExplorer';

describe('getBtcExplorerTxUrl', () => {
  it('returns null without txid', () => {
    expect(getBtcExplorerTxUrl(null, 'signet')).toBeNull();
    expect(getBtcExplorerTxUrl('', 'mainnet')).toBeNull();
  });

  it('builds signet and mainnet URLs', () => {
    expect(getBtcExplorerTxUrl('deadbeef', 'signet')).toBe(
      'https://mempool.space/signet/tx/deadbeef',
    );
    expect(getBtcExplorerTxUrl('deadbeef', 'mainnet')).toBe(
      'https://mempool.space/tx/deadbeef',
    );
  });

  it('falls back to signet for unknown networks', () => {
    expect(getBtcExplorerTxUrl('deadbeef', 'unknown')).toBe(
      'https://mempool.space/signet/tx/deadbeef',
    );
  });
});
