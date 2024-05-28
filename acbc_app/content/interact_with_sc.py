import os
from web3 import Web3
from .contract_abis import acbc_token_abi, hash_store_abi


class HashStoreSmartContract:
    def __init__(self, from_address=None, private_key=None):
        self.alchemy_api_key = os.getenv('ALCHEMY_API_KEY')
        self.web3 = Web3(Web3.HTTPProvider(f"https://eth-sepolia.g.alchemy.com/v2/{self.alchemy_api_key}"))
        if self.web3.is_connected():
            print('Connected to Sepolia testnet')
        else:
            raise ConnectionError('Failed to connect to Sepolia testnet')

        self.hash_store_address = '0xc18bc0121630a6848b32d4ded7D23db641180117'
        self.hash_store_contract_abi = hash_store_abi
        self.hash_store_contract = self.web3.eth.contract(address=self.hash_store_address,
                                                          abi=self.hash_store_contract_abi)
        self.from_address = from_address
        self.private_key = private_key

    def store_hash(self, hash_value):
        try:
            nonce = self.web3.eth.getTransactionCount(self.from_address)
            tx = self.hash_store_contract.functions.storeHash(hash_value).buildTransaction({
                'from': self.from_address,
                'nonce': nonce,
                'gas': 2000000,
                'gasPrice': self.web3.toWei('50', 'gwei')
            })
            signed_tx = self.web3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.web3.eth.sendRawTransaction(signed_tx.rawTransaction)
            receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)
            print(f'Transaction successful with hash: {self.web3.toHex(tx_hash)}')
            return receipt
        except Exception as e:
            print(f'Error storing hash: {e}')

    def set_reward_amount(self, reward_amount):
        try:
            nonce = self.web3.eth.getTransactionCount(self.from_address)
            tx = self.hash_store_contract.functions.setRewardAmount(reward_amount).buildTransaction({
                'from': self.from_address,
                'nonce': nonce,
                'gas': 2000000,
                'gasPrice': self.web3.toWei('50', 'gwei')
            })
            signed_tx = self.web3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.web3.eth.sendRawTransaction(signed_tx.rawTransaction)
            receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)
            print(f'Transaction successful with hash: {self.web3.toHex(tx_hash)}')
            return receipt
        except Exception as e:
            print(f'Error setting reward amount: {e}')

    def is_hash_stored(self, hash_value):
        try:
            # Ensure the hash value is in bytes32 format
            if isinstance(hash_value, str):
                print(f'Hash value {hash_value} is a string, converting to bytes32')
                hash_value = Web3.to_bytes(hexstr=hash_value)
                print(f'Converted hash value: {hash_value}, type: {type(hash_value)}')
            result = self.hash_store_contract.functions.isHashStored(hash_value).call()
            print(f'Is hash stored: {result}')
            return result
        except Exception as e:
            print(f'Error checking hash: {e}')
            raise

    def get_user_by_hash(self, hash_value):
        try:
            user = self.hash_store_contract.functions.getUserByHash(hash_value).call()
            print(f'User that stored the hash: {user}')
            return user
        except Exception as e:
            print(f'Error getting user by hash: {e}')

    def get_hashes_by_user(self, user_address):
        try:
            hashes = self.hash_store_contract.functions.getHashesByUser(user_address).call()
            print(f'Hashes stored by user: {hashes}')
            return hashes
        except Exception as e:
            print(f'Error getting hashes by user: {e}')

    def get_my_hashes(self):
        try:
            hashes = self.hash_store_contract.functions.getMyHashes().call({'from': self.from_address})
            print(f'My stored hashes: {hashes}')
            return hashes
        except Exception as e:
            print(f'Error getting my hashes: {e}')

# Interact with the HashStore contract
# Example: Check if a hash is stored
# example_hash = web3.keccak(text='example hash')
# is_stored = hash_store.functions.isHashStored(example_hash).call()
# print(f'Is Hash Stored: {is_stored}')
#
# # Example: Store a hash (requires sending a transaction)
# from_account = '0xYourEthereumAddress'
# private_key = 'YourPrivateKey'
#
# # Create a transaction to store a hash
# tx = hash_store.functions.storeHash(example_hash, from_account).buildTransaction({
#     'from': from_account,
#     'nonce': web3.eth.getTransactionCount(from_account),
#     'gas': 2000000,
#     'gasPrice': web3.toWei('50', 'gwei')
# })
#
# # Sign the transaction
# signed_tx = web3.eth.account.sign_transaction(tx, private_key)
#
# # Send the transaction
# tx_hash = web3.eth.sendRawTransaction(signed_tx.rawTransaction)
# print(f'Transaction Hash: {web3.toHex(tx_hash)}')
#
# # Wait for the transaction receipt
# receipt = web3.eth.waitForTransactionReceipt(tx_hash)
# print(f'Transaction Receipt: {receipt}')
