import { binToHex, hash256, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { publicKeyToP2PKHLockingBytecode } from 'cashscript/dist/utils.js';

const DUST = 1000n;
const FEE = 1000n;

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

async function walletSign(manager, builder, addressIndex, prompt) {
  const wcObject = builder.generateWcTransactionObject({
    broadcast: true,
    userPrompt: prompt,
  });
  const response = await manager.signTransaction({
    transaction: wcObject,
    inputPaths: inputPaths(builder.inputs, addressIndex),
  });
  if (response?.error) {
    throw new Error(response.error);
  }
  return txidFromRaw(response.signedTransaction);
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
  const txid = await walletSign(
    manager,
    builder,
    addressIndex,
    'Open this knowledge-path campaign',
  );
  return { txid, contractAddress: contract.tokenAddress, prefix };
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
