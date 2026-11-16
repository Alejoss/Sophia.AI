import { readFileSync } from 'node:fs';
import {
  Contract,
  MockNetworkProvider,
  SignatureTemplate,
  TransactionBuilder,
} from 'cashscript';
import { publicKeyToP2PKHLockingBytecode } from 'cashscript/dist/utils.js';
import {
  binToHex,
  CashAddressNetworkPrefix,
  lockingBytecodeToCashAddress,
} from '@bitauth/libauth';

const artifact = JSON.parse(readFileSync(new URL('./artifact.json', import.meta.url), 'utf8'));
const DUST = 1000n;
const MIN_PLEDGE = 10000n;
const FEE = 1000n;

function bytes8(value) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(BigInt(value));
  return bytes.toString('hex');
}

function tokenAddress(lockingBytecode) {
  const encoded = lockingBytecodeToCashAddress({
    bytecode: lockingBytecode,
    prefix: CashAddressNetworkPrefix.testnet,
    tokenSupport: true,
  });
  if (typeof encoded === 'string') {
    throw new Error(encoded);
  }
  return encoded.address;
}

function plainAddress(lockingBytecode) {
  const encoded = lockingBytecodeToCashAddress({
    bytecode: lockingBytecode,
    prefix: CashAddressNetworkPrefix.testnet,
    tokenSupport: false,
  });
  if (typeof encoded === 'string') {
    throw new Error(encoded);
  }
  return encoded.address;
}

function keypair(byte) {
  const privateKey = new Uint8Array(32).fill(byte);
  const signer = new SignatureTemplate(privateKey);
  const lockingBytecode = publicKeyToP2PKHLockingBytecode(signer.getPublicKey());
  return { signer, lockingBytecode };
}

function campaignUtxo(txid, satoshis, commitment) {
  return {
    txid,
    vout: 0,
    satoshis,
    token: {
      category: CATEGORY,
      amount: 0n,
      nft: { capability: 'minting', commitment },
    },
  };
}

const CATEGORY = 'ab'.repeat(32);
const provider = new MockNetworkProvider();
const author = keypair(1);
const supporter = keypair(2);
const contract = new Contract(
  artifact,
  [1n, 25000n, 1_900_000_000n, binToHex(author.lockingBytecode)],
  { provider, addressType: 'p2sh32' },
);

const genesis = campaignUtxo('11'.repeat(32), DUST, '00');
provider.addUtxo(contract.tokenAddress, genesis);
provider.addUtxo(plainAddress(supporter.lockingBytecode), {
  txid: '22'.repeat(32),
  vout: 0,
  satoshis: MIN_PLEDGE + DUST + FEE,
});

const pledgeCommitment = bytes8(1n) + bytes8(MIN_PLEDGE);
const pledged = await new TransactionBuilder({ provider })
  .addInput(genesis, contract.unlock.pledge())
  .addInput(
    {
      txid: '22'.repeat(32),
      vout: 0,
      satoshis: MIN_PLEDGE + DUST + FEE,
    },
    supporter.signer.unlockP2PKH(),
  )
  .addOutput({
    to: contract.tokenAddress,
    amount: DUST + MIN_PLEDGE,
    token: {
      category: CATEGORY,
      amount: 0n,
      nft: { capability: 'minting', commitment: '00' },
    },
  })
  .addOutput({
    to: tokenAddress(supporter.lockingBytecode),
    amount: DUST,
    token: {
      category: CATEGORY,
      amount: 0n,
      nft: { capability: 'none', commitment: pledgeCommitment },
    },
  })
  .send();

const refunded = await new TransactionBuilder({ provider })
  .addInput(campaignUtxo(pledged.txid, DUST + MIN_PLEDGE, '00'), contract.unlock.refund())
  .addInput(
    {
      txid: pledged.txid,
      vout: 1,
      satoshis: DUST,
      token: {
        category: CATEGORY,
        amount: 0n,
        nft: { capability: 'none', commitment: pledgeCommitment },
      },
    },
    supporter.signer.unlockP2PKH(),
  )
  .addOutput({
    to: contract.tokenAddress,
    amount: DUST,
    token: {
      category: CATEGORY,
      amount: 0n,
      nft: { capability: 'minting', commitment: '00' },
    },
  })
  .addOutput({
    to: plainAddress(supporter.lockingBytecode),
    amount: MIN_PLEDGE,
  })
  .send();

const fundedGenesis = campaignUtxo('44'.repeat(32), DUST, '00');
provider.addUtxo(contract.tokenAddress, fundedGenesis);
const fundedCommitment = bytes8(1n) + bytes8(25000n);
provider.addUtxo(plainAddress(supporter.lockingBytecode), {
  txid: '33'.repeat(32),
  vout: 0,
  satoshis: 25000n + DUST + FEE,
});
const funded = await new TransactionBuilder({ provider })
  .addInput(fundedGenesis, contract.unlock.pledge())
  .addInput(
    {
      txid: '33'.repeat(32),
      vout: 0,
      satoshis: 25000n + DUST + FEE,
    },
    supporter.signer.unlockP2PKH(),
  )
  .addOutput({
    to: contract.tokenAddress,
    amount: DUST + 25000n,
    token: {
      category: CATEGORY,
      amount: 0n,
      nft: { capability: 'minting', commitment: '01' },
    },
  })
  .addOutput({
    to: tokenAddress(supporter.lockingBytecode),
    amount: DUST,
    token: {
      category: CATEGORY,
      amount: 0n,
      nft: { capability: 'none', commitment: fundedCommitment },
    },
  })
  .send();

let refundAfterFundedFailed = '';
try {
  await new TransactionBuilder({ provider })
    .addInput(campaignUtxo(funded.txid, DUST + 25000n, '01'), contract.unlock.refund())
    .addInput(
      {
        txid: funded.txid,
        vout: 1,
        satoshis: DUST,
        token: {
          category: CATEGORY,
          amount: 0n,
          nft: { capability: 'none', commitment: fundedCommitment },
        },
      },
    supporter.signer.unlockP2PKH(),
  )
  .addOutput({
    to: contract.tokenAddress,
    amount: DUST,
    token: {
      category: CATEGORY,
      amount: 0n,
      nft: { capability: 'minting', commitment: '01' },
    },
  })
    .addOutput({
      to: plainAddress(supporter.lockingBytecode),
      amount: 25000n,
    })
    .send();
} catch (error) {
  refundAfterFundedFailed = String(error.message || error).split('\n').slice(0, 3).join(' ');
}

const claimed = await new TransactionBuilder({ provider })
  .addInput(campaignUtxo(funded.txid, DUST + 25000n, '01'), contract.unlock.claim())
  .addOutput({
    to: plainAddress(author.lockingBytecode),
    amount: DUST + 25000n,
  })
  .send();

const missedGenesis = campaignUtxo('55'.repeat(32), DUST + MIN_PLEDGE, '00');
const missedCommitment = bytes8(1n) + bytes8(MIN_PLEDGE);
provider.addUtxo(contract.tokenAddress, missedGenesis);
provider.addUtxo(tokenAddress(supporter.lockingBytecode), {
  txid: '66'.repeat(32),
  vout: 1,
  satoshis: DUST,
  token: {
    category: CATEGORY,
    amount: 0n,
    nft: { capability: 'none', commitment: missedCommitment },
  },
});

const expired = await new TransactionBuilder({ provider })
  .setLocktime(1_900_000_000)
  .addInput(missedGenesis, contract.unlock.expire())
  .addOutput({
    to: contract.tokenAddress,
    amount: DUST + MIN_PLEDGE,
    token: {
      category: CATEGORY,
      amount: 0n,
      nft: { capability: 'minting', commitment: '02' },
    },
  })
  .send();

const reclaimed = await new TransactionBuilder({ provider })
  .addInput(campaignUtxo(expired.txid, DUST + MIN_PLEDGE, '02'), contract.unlock.refund())
  .addInput(
    {
      txid: '66'.repeat(32),
      vout: 1,
      satoshis: DUST,
      token: {
        category: CATEGORY,
        amount: 0n,
        nft: { capability: 'none', commitment: missedCommitment },
      },
    },
    supporter.signer.unlockP2PKH(),
  )
  .addOutput({
    to: contract.tokenAddress,
    amount: DUST,
    token: {
      category: CATEGORY,
      amount: 0n,
      nft: { capability: 'minting', commitment: '02' },
    },
  })
  .addOutput({
    to: plainAddress(supporter.lockingBytecode),
    amount: MIN_PLEDGE,
  })
  .send();

let claimAfterExpiredFailed = '';
try {
  await new TransactionBuilder({ provider })
    .addInput(campaignUtxo(reclaimed.txid, DUST, '02'), contract.unlock.claim())
    .addOutput({
      to: plainAddress(author.lockingBytecode),
      amount: DUST,
    })
    .send();
} catch (error) {
  claimAfterExpiredFailed = String(error.message || error).split('\n').slice(0, 3).join(' ');
}

if (!refundAfterFundedFailed.includes('require(stillOpen || expired)')) {
  throw new Error(`Funded refund failed for an unexpected reason: ${refundAfterFundedFailed}`);
}
if (!claimAfterExpiredFailed.includes('nftCommitment == 0x01')) {
  throw new Error(`Expired claim failed for an unexpected reason: ${claimAfterExpiredFailed}`);
}

console.log(JSON.stringify({
  pledge: pledged.txid,
  refund: refunded.txid,
  fund: funded.txid,
  claim: claimed.txid,
  expire: expired.txid,
  reclaim: reclaimed.txid,
  refundAfterFundedFailed,
  claimAfterExpiredFailed,
}, null, 2));
