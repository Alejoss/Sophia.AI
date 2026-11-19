import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { addressFromPublicKey, chooseFundedWallet, relaySignTransaction, selectOpenCoin } from '../buildCampaignTx';

describe('selectOpenCoin', () => {
  it('uses a first-payment coin that is already large enough', () => {
    const picked = selectOpenCoin([
      { txid: 'aa', vout: 1, satoshis: 10000, token: null },
      { txid: 'bb', vout: 0, satoshis: 5000, token: null },
    ]);
    expect(picked.needsPrepare).toBe(false);
    expect(picked.utxo.txid).toBe('bb');
  });

  it('rearranges a later payment when that is the only coin', () => {
    const picked = selectOpenCoin([
      { txid: 'aa', vout: 1, satoshis: 10000, token: null },
    ]);
    expect(picked.needsPrepare).toBe(true);
    expect(picked.utxo.satoshis).toBe(10000);
  });

  it('asks for a larger payment when the only coin cannot cover the extra move', () => {
    const picked = selectOpenCoin([
      { txid: 'aa', vout: 1, satoshis: 3500, token: null },
    ]);
    expect(picked.utxo).toBeNull();
    expect(picked.minimum).toBe(4001);
  });
});

describe('chooseFundedWallet', () => {
  it('uses a later receive address when the first one is empty', () => {
    const chosen = chooseFundedWallet([
      { index: 0, balance: 0, picked: { utxo: null, minimum: 3001 } },
      {
        index: 2,
        balance: 1027000,
        picked: { utxo: { txid: 'aa', vout: 0, satoshis: 1017000 }, minimum: 3001 },
      },
    ]);
    expect(chosen.index).toBe(2);
  });
});

describe('relaySignTransaction', () => {
  it('sends the opening payment as text the wallet connection can carry', async () => {
    const { MockNetworkProvider, TransactionBuilder } = await import('cashscript');
    const { placeholderP2PKHUnlocker } = await import('cashscript/dist/walletconnect-utils.js');
    const { address } = addressFromPublicKey(
      hexToBin('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'),
      'bitcoincash',
    );
    const provider = new MockNetworkProvider();
    provider.network = 'mainnet';
    const builder = new TransactionBuilder({ provider })
      .addInput(
        { txid: '11'.repeat(32), vout: 1, satoshis: 10000n },
        placeholderP2PKHUnlocker(address),
      )
      .addOutput({ to: address, amount: 9000n });
    const wcObject = builder.generateWcTransactionObject({ broadcast: true, userPrompt: 'Open' });
    expect(() => JSON.stringify(wcObject)).toThrow(/BigInt/);
    const relay = relaySignTransaction(wcObject);
    const encoded = JSON.stringify(relay);
    expect(encoded).toContain('<bigint: 10000n>');
    expect(encoded).toContain('2823000000000000');
    expect(typeof relay.transaction).toBe('string');
  });
});
