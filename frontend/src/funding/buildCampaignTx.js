import {
  binToHex,
  decodeHdPublicKey,
  deriveHdPublicNodeChild,
  hash256,
  hexToBin,
  lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { publicKeyToP2PKHLockingBytecode } from 'cashscript/dist/utils.js';
import { sourceOutputToRelay, transactionToHex } from '@wizardconnect/core/hdwalletv1-serialize';

const DUST = 1000n;
const FEE = 1000n;

/** Smallest coin that can open: miner fee, locked dust, and change above dust. */
export const OPEN_MIN_SATS = 3001;

/**
 * A new investigation token can only be created by spending a coin that was
 * the first payment of its transaction. Faucets often pay the user second.
 * Pick a ready coin, or a larger coin the wallet can pay back to itself first.
 */
export function selectOpenCoin(utxos) {
  const plain = (utxos || []).filter((item) => item && !item.token);
  const ready = plain.find((item) => item.vout === 0 && Number(item.satoshis) >= OPEN_MIN_SATS);
  if (ready) return { utxo: ready, needsPrepare: false, minimum: OPEN_MIN_SATS };
  const minimum = OPEN_MIN_SATS + Number(FEE);
  const source = plain
    .filter((item) => Number(item.satoshis) >= minimum)
    .sort((a, b) => Number(b.satoshis) - Number(a.satoshis))[0];
  if (source) return { utxo: source, needsPrepare: true, minimum };
  return { utxo: null, needsPrepare: false, minimum: plain.length ? minimum : OPEN_MIN_SATS };
}

/** Prefer a receive address that can open. Otherwise show the one holding coins. */
export function chooseFundedWallet(wallets) {
  const list = (wallets || []).filter(Boolean);
  const ready = list.filter((item) => item.picked?.utxo);
  if (ready.length) {
    ready.sort((a, b) => Number(b.picked.utxo.satoshis) - Number(a.picked.utxo.satoshis));
    return ready[0];
  }
  const funded = list.filter((item) => item.balance > 0);
  if (funded.length) {
    funded.sort((a, b) => b.balance - a.balance);
    return funded[0];
  }
  return list[0] || null;
}

function publicKeyAt(manager, index) {
  const direct = manager.getPubkey?.(0, BigInt(index));
  if (direct) return direct;
  const paths = typeof manager.getSessionPaths === 'function' ? manager.getSessionPaths() : [];
  const receive = paths.find((path) => String(path?.name || '').toLowerCase() === 'receive') || paths[0];
  if (!receive?.xpub) return undefined;
  const decoded = decodeHdPublicKey(receive.xpub);
  if (typeof decoded === 'string') return undefined;
  const child = deriveHdPublicNodeChild(decoded.node, index);
  if (typeof child === 'string') return undefined;
  return child.publicKey;
}

export async function findOpenWallet({ manager, prefix, getUtxos, limit = 20 }) {
  const wallets = [];
  for (let index = 0; index < limit; index += 1) {
    const publicKey = publicKeyAt(manager, index);
    if (!publicKey) break;
    const derived = addressFromPublicKey(publicKey, prefix);
    const utxos = await getUtxos(derived.address);
    const plain = (utxos || []).filter((item) => item && !item.token);
    wallets.push({
      ...derived,
      index,
      utxos,
      balance: plain.reduce((sum, item) => sum + Number(item.satoshis || 0), 0),
      picked: selectOpenCoin(utxos),
    });
  }
  return chooseFundedWallet(wallets);
}

function providerFor(prefix, MockNetworkProvider) {
  const provider = new MockNetworkProvider();
  if (prefix === 'bitcoincash') provider.network = 'mainnet';
  else if (prefix === 'bchreg') provider.network = 'regtest';
  else provider.network = 'chipnet';
  return provider;
}

function prefixOf(proposal) {
  return (proposal.author_payout_address || 'bitcoincash:').split(':')[0];
}

export function addressFromPublicKey(publicKey, prefix) {
  const lockingBytecode = publicKeyToP2PKHLockingBytecode(publicKey);
  const encoded = lockingBytecodeToCashAddress({
    bytecode: lockingBytecode,
    prefix,
    tokenSupport: false,
  });
  if (typeof encoded === 'string') {
    throw new Error(encoded);
  }
  return { address: encoded.address, lockingBytecode };
}

export function tokenAddress(lockingBytecode, prefix) {
  const encoded = lockingBytecodeToCashAddress({
    bytecode: lockingBytecode,
    prefix,
    tokenSupport: true,
  });
  if (typeof encoded === 'string') {
    throw new Error(encoded);
  }
  return encoded.address;
}

export function txidFromRaw(rawHex) {
  const hashed = hash256(hexToBin(rawHex));
  return binToHex(Uint8Array.from(hashed).reverse());
}

export function cashscriptArgs(constructorArgs) {
  const [proposalId, goalSats, deadline, authorLockingBytecode] = constructorArgs;
  return [BigInt(proposalId), BigInt(goalSats), BigInt(deadline), authorLockingBytecode];
}

function inputPaths(inputs, addressIndex) {
  return inputs.map((input) => (
    input.unlocker?.contract ? [0, 'receive', 0] : [0, 'receive', addressIndex]
  ));
}

function relaySourceOutput(output) {
  const relay = sourceOutputToRelay(output);
  if (!output.contract) return relay;
  const redeemScript = output.contract.redeemScript;
  return {
    ...relay,
    contract: {
      ...output.contract,
      redeemScript: redeemScript instanceof Uint8Array ? binToHex(redeemScript) : redeemScript,
    },
  };
}

/** WizardConnect sends the payment as JSON. Libauth amounts are BigInt, which JSON cannot send. */
export function relaySignTransaction(wcObject) {
  const tx = wcObject.transaction;
  return {
    ...wcObject,
    transaction: transactionToHex(tx.inputs, tx.outputs, tx.version, tx.locktime),
    sourceOutputs: wcObject.sourceOutputs.map(relaySourceOutput),
  };
}

async function walletSign(manager, builder, addressIndex, prompt) {
  const wcObject = builder.generateWcTransactionObject({
    broadcast: true,
    userPrompt: prompt,
  });
  const response = await manager.signTransaction({
    transaction: relaySignTransaction(wcObject),
    inputPaths: inputPaths(builder.inputs, addressIndex),
  });
  if (response?.error) {
    throw new Error(response.error);
  }
  const rawHex = response.signedTransaction;
  return { txid: txidFromRaw(rawHex), rawHex };
}

export async function prepareOpenCoinTx({
  manager,
  utxo,
  userAddress,
  addressIndex,
}) {
  const { MockNetworkProvider, TransactionBuilder } = await import('cashscript');
  const { placeholderP2PKHUnlocker } = await import('cashscript/dist/walletconnect-utils.js');
  const prefix = userAddress.split(':')[0];
  const provider = providerFor(prefix, MockNetworkProvider);
  const satoshis = BigInt(utxo.satoshis);
  const amount = satoshis - FEE;
  if (amount <= DUST) {
    throw new Error('The wallet coin is too small to open the campaign.');
  }
  const builder = new TransactionBuilder({ provider })
    .addInput(
      { txid: utxo.txid, vout: utxo.vout, satoshis },
      placeholderP2PKHUnlocker(userAddress),
    )
    .addOutput({ to: userAddress, amount });
  const signed = await walletSign(
    manager,
    builder,
    addressIndex,
    'Move your Bitcoin Cash so this investigation can be opened',
  );
  return { txid: signed.txid, rawHex: signed.rawHex, satoshis: Number(amount) };
}

export async function openCampaignTx({
  manager,
  artifact,
  proposal,
  utxo,
  userAddress,
  addressIndex,
  prefix,
}) {
  const { Contract, MockNetworkProvider, TransactionBuilder } = await import('cashscript');
  const { placeholderP2PKHUnlocker } = await import('cashscript/dist/walletconnect-utils.js');
  if (utxo.vout !== 0) {
    throw new Error('The coin that mints the campaign NFT has to be output 0.');
  }
  const provider = providerFor(prefix, MockNetworkProvider);
  const contract = new Contract(artifact, cashscriptArgs(proposal.constructor_args), {
    provider,
    addressType: 'p2sh32',
  });
  const satoshis = BigInt(utxo.satoshis);
  const change = satoshis - DUST - FEE;
  if (change <= DUST) {
    throw new Error('The wallet coin is too small to open the campaign.');
  }
  const builder = new TransactionBuilder({ provider })
    .addInput(
      { txid: utxo.txid, vout: utxo.vout, satoshis },
      placeholderP2PKHUnlocker(userAddress),
    )
    .addOutput({
      to: contract.tokenAddress,
      amount: DUST,
      token: {
        category: utxo.txid,
        amount: 0n,
        nft: { capability: 'minting', commitment: '00' },
      },
    })
    .addOutput({ to: userAddress, amount: change });
  const signed = await walletSign(
    manager,
    builder,
    addressIndex,
    'Open this knowledge-path campaign',
  );
  return { txid: signed.txid, rawHex: signed.rawHex, contractAddress: contract.tokenAddress, prefix };
}

export async function pledgeTx({
  manager,
  artifact,
  proposal,
  campaign,
  amountSats,
  utxo,
  userAddress,
  lockingBytecode,
  addressIndex,
  prefix,
}) {
  const { Contract, MockNetworkProvider, TransactionBuilder } = await import('cashscript');
  const { placeholderP2PKHUnlocker } = await import('cashscript/dist/walletconnect-utils.js');
  const provider = providerFor(prefix, MockNetworkProvider);
  const contract = new Contract(artifact, cashscriptArgs(proposal.constructor_args), {
    provider,
    addressType: 'p2sh32',
  });
  const added = BigInt(amountSats);
  const available = BigInt(utxo.satoshis);
  const change = available - added - DUST - FEE;
  if (change < 0n) {
    throw new Error('The selected coin does not cover the pledge, the NFT, and the fee.');
  }
  const nextState = BigInt(campaign.satoshis) - DUST + added >= BigInt(proposal.goal_sats) ? '01' : '00';
  const commitment = bytes8(proposal.id) + bytes8(added);
  let builder = new TransactionBuilder({ provider })
    .addInput(
      campaignUtxo(campaign),
      contract.unlock.pledge(),
    )
    .addInput(
      { txid: utxo.txid, vout: utxo.vout, satoshis: available },
      placeholderP2PKHUnlocker(userAddress),
    )
    .addOutput({
      to: contract.tokenAddress,
      amount: BigInt(campaign.satoshis) + added,
      token: {
        category: campaign.category,
        amount: 0n,
        nft: { capability: 'minting', commitment: nextState },
      },
    })
    .addOutput({
      to: tokenAddress(lockingBytecode, prefix),
      amount: DUST,
      token: {
        category: campaign.category,
        amount: 0n,
        nft: { capability: 'none', commitment },
      },
    });
  if (change > 0n) {
    builder = builder.addOutput({ to: userAddress, amount: change });
  }
  return walletSign(manager, builder, addressIndex, 'Pledge Bitcoin Cash to this knowledge path');
}

export async function refundTx({
  manager,
  artifact,
  proposal,
  spec,
  userAddress,
  addressIndex,
}) {
  const { Contract, MockNetworkProvider, TransactionBuilder } = await import('cashscript');
  const { placeholderP2PKHUnlocker } = await import('cashscript/dist/walletconnect-utils.js');
  const provider = providerFor(prefixOf(proposal), MockNetworkProvider);
  const contract = new Contract(artifact, cashscriptArgs(spec.constructor_args || proposal.constructor_args), {
    provider,
    addressType: 'p2sh32',
  });
  const amount = BigInt(spec.nft.amount_sats);
  const builder = new TransactionBuilder({ provider })
    .addInput(campaignUtxo(spec.campaign), contract.unlock.refund())
    .addInput(
      {
        txid: spec.nft.txid,
        vout: spec.nft.vout,
        satoshis: BigInt(spec.nft.satoshis),
        token: {
          category: spec.nft.category,
          amount: 0n,
          nft: { capability: 'none', commitment: spec.nft.commitment },
        },
      },
      placeholderP2PKHUnlocker(userAddress),
    )
    .addOutput({
      to: contract.tokenAddress,
      amount: BigInt(spec.campaign.satoshis) - amount,
      token: {
        category: spec.campaign.category,
        amount: 0n,
        nft: { capability: 'minting', commitment: spec.campaign.commitment },
      },
    })
    .addOutput({ to: userAddress, amount });
  return walletSign(manager, builder, addressIndex, 'Reclaim this pledge');
}

export async function claimTx({
  manager,
  artifact,
  proposal,
  spec,
  feeUtxo,
  userAddress,
  addressIndex,
}) {
  const { Contract, MockNetworkProvider, TransactionBuilder } = await import('cashscript');
  const { placeholderP2PKHUnlocker } = await import('cashscript/dist/walletconnect-utils.js');
  const provider = providerFor(prefixOf(proposal), MockNetworkProvider);
  const contract = new Contract(artifact, cashscriptArgs(spec.constructor_args), {
    provider,
    addressType: 'p2sh32',
  });
  let builder = new TransactionBuilder({ provider })
    .addInput(campaignUtxo(spec.campaign), contract.unlock.claim())
    .addOutput({
      to: spec.author_payout_address,
      amount: BigInt(spec.campaign.satoshis),
    });
  if (feeUtxo) {
    const available = BigInt(feeUtxo.satoshis);
    const change = available - FEE;
    builder = builder.addInput(
      { txid: feeUtxo.txid, vout: feeUtxo.vout, satoshis: available },
      placeholderP2PKHUnlocker(userAddress),
    );
    if (change > 0n) {
      builder = builder.addOutput({ to: userAddress, amount: change });
    }
  }
  return walletSign(manager, builder, addressIndex, 'Claim the funded knowledge path');
}

export async function expireTx({
  manager,
  artifact,
  proposal,
  campaign,
  feeUtxo,
  userAddress,
  addressIndex,
}) {
  const { Contract, MockNetworkProvider, TransactionBuilder } = await import('cashscript');
  const { placeholderP2PKHUnlocker } = await import('cashscript/dist/walletconnect-utils.js');
  const locktime = Math.floor(Date.parse(proposal.deadline) / 1000);
  if (!Number.isFinite(locktime)) {
    throw new Error('The deadline is missing.');
  }
  const provider = providerFor(prefixOf(proposal), MockNetworkProvider);
  const contract = new Contract(artifact, cashscriptArgs(proposal.constructor_args), {
    provider,
    addressType: 'p2sh32',
  });
  const available = BigInt(feeUtxo.satoshis);
  const change = available - FEE;
  let builder = new TransactionBuilder({ provider })
    .setLocktime(locktime)
    .addInput(campaignUtxo(campaign), contract.unlock.expire())
    .addOutput({
      to: contract.tokenAddress,
      amount: BigInt(campaign.satoshis),
      token: {
        category: campaign.category,
        amount: 0n,
        nft: { capability: 'minting', commitment: '02' },
      },
    })
    .addInput(
      { txid: feeUtxo.txid, vout: feeUtxo.vout, satoshis: available },
      placeholderP2PKHUnlocker(userAddress),
    );
  if (change > 0n) {
    builder = builder.addOutput({ to: userAddress, amount: change });
  }
  return walletSign(manager, builder, addressIndex, 'Close pledges because the deadline passed');
}

function campaignUtxo(campaign) {
  return {
    txid: campaign.txid,
    vout: campaign.vout,
    satoshis: BigInt(campaign.satoshis),
    token: {
      category: campaign.category,
      amount: 0n,
      nft: { capability: campaign.capability || 'minting', commitment: campaign.commitment },
    },
  };
}

function bytes8(value) {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, BigInt(value), true);
  return binToHex(bytes);
}
