# Blockchain Integration

This document describes the blockchain integration architecture for the Sophia.AI Academia Blockchain platform.

## Overview

The platform integrates with blockchain networks (primarily Polygon) to provide decentralized certification and verification of documents and certificates.

## Architecture Components

### Smart Contracts

Located in `contracts/contracts/`:

- **SophiaAIParams**: Manages platform parameters, costs, and earnings
- **HashStore**: Stores document hashes on-chain
- **ACBCToken**: Token contract (if applicable)
- **SophiaAIParamsConsumer**: Consumer contract for Chainlink Functions

### Backend Integration

Web3 integration code in `acbc_app/content/web3/`:

- `web3_utils.py`: Web3 utility functions
- `contract_abis.py`: Contract ABIs
- `interact_with_sc.py`: Smart contract interaction
- `deploy_contract.py`: Contract deployment utilities

### Frontend Integration

Frontend can interact with contracts via:
- MetaMask or other Web3 wallets
- Backend API endpoints that interact with contracts

## Blockchain Network

### Supported Networks

- **Polygon Mainnet**: Production network (Chain ID: 137)
- **Polygon Amoy Testnet**: Test network (Chain ID: 80002)
- **Hardhat Local**: Local development (Chain ID: 31337)

### Network Configuration

Configured in `contracts/hardhat.config.js`:

```javascript
networks: {
  hardhat: {
    chainId: 31337,
    // Local development
  },
  testnet: {
    chainId: 80002,
    url: "https://rpc-amoy.polygon.technology",
  },
  mainnet: {
    chainId: 137,
    url: "https://polygon-mainnet.infura.io",
  }
}
```

## Certificate Flow

### 1. Certificate Generation

1. User completes a course/knowledge path
2. Backend generates certificate data
3. Certificate hash is computed

### 2. On-Chain Storage

1. Backend calls smart contract to store hash
2. Transaction is sent to blockchain
3. Transaction hash is stored in database

### 3. Verification

1. User shares certificate
2. Verifier can check hash on-chain
3. Verify authenticity of certificate

## Smart Contract Interaction

### Backend Interaction

```python
from content.web3.interact_with_sc import store_hash

# Store certificate hash on-chain
tx_hash = store_hash(certificate_hash, user_address)
```

### Frontend Interaction

Users can interact with contracts via MetaMask:

```javascript
// Connect to MetaMask
await window.ethereum.request({ method: 'eth_requestAccounts' });

// Interact with contract
const contract = new ethers.Contract(contractAddress, abi, signer);
await contract.someFunction();
```

## Chainlink Functions

Used for external data fetching and computation:

- Price feeds for cryptocurrency conversion
- External API calls
- Off-chain computation

## Security Considerations

1. **Private Key Management**: Never expose private keys
2. **Transaction Signing**: Use secure signing mechanisms
3. **Gas Optimization**: Optimize contract calls
4. **Error Handling**: Handle blockchain errors gracefully
5. **Network Failures**: Implement retry logic

## Development Setup

### Local Blockchain

```bash
cd contracts
npx hardhat node
```

### Deploy Contracts

```bash
npx hardhat run scripts/ParamsDeploy.js --network localhost
```

### Connect MetaMask

1. Add local network (Chain ID: 31337)
2. Import test account
3. Fund account with test ETH

## Related Documentation

- [Contract Development](../development/contracts/contracts.md)
- [Contract Deployment](../development/contracts/deployment.md)
- [Backend Web3 Integration](../development/backend/web3-integration.md)

