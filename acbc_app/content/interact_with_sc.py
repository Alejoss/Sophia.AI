import os
from web3 import Web3
from .contract_abis import acbc_token_abi, hash_store_abi


class HashStoreIpfsSmartContract:
    def __init__(self, from_address, private_key):
        self.alchemy_api_key = os.getenv('ALCHEMY_API_KEY')
        self.web3 = Web3(Web3.HTTPProvider(f"https://eth-sepolia.g.alchemy.com/v2/{self.alchemy_api_key}"))
        if self.web3.is_connected():
            print('Connected to Sepolia testnet')
        else:
            raise ConnectionError('Failed to connect to Sepolia testnet')

        self.hash_store_address = '0x8c3343b611f25063125A31d84a512b2802eAccD3'
        self.hash_store_contract_abi = hash_store_abi
        self.hash_store_contract = self.web3.eth.contract(address=self.hash_store_address,
                                                          abi=self.hash_store_contract_abi)

        self.from_address = from_address
        self.balance = self.web3.eth.get_balance(from_address)
        print(f'Balance: {self.web3.from_wei(self.balance, "ether")} ETH')

        self.private_key = private_key

    def store_hash(self, hash_value, ipfs_content_id=""):
        try:
            print(f'Original hash value: {hash_value}')
            print(f'Original IPFS content ID: {ipfs_content_id}')

            if isinstance(hash_value, str):
                print(f'Hash value {hash_value} is a string, converting to bytes32')
                hash_value = Web3.to_bytes(hexstr=hash_value)
                print(f'Converted hash value: {hash_value}, type: {type(hash_value)}')

            nonce = self.web3.eth.get_transaction_count(self.from_address)
            print(f'Nonce: {nonce}')

            latest_block = self.web3.eth.get_block('latest')
            base_fee_per_gas = latest_block['baseFeePerGas']
            max_priority_fee_per_gas = self.web3.to_wei('2', 'gwei')
            max_fee_per_gas = base_fee_per_gas + max_priority_fee_per_gas

            print(f'Base fee per gas: {base_fee_per_gas}')
            print(f'Max priority fee per gas: {max_priority_fee_per_gas}')
            print(f'Max fee per gas: {max_fee_per_gas}')

            gas_estimate = self.hash_store_contract.functions.storeHash(hash_value, ipfs_content_id).estimate_gas({
                'from': self.from_address,
                'nonce': nonce
            })
            print(f'Estimated Gas: {gas_estimate}')

            tx = self.hash_store_contract.functions.storeHash(hash_value, ipfs_content_id).build_transaction({
                'from': self.from_address,
                'nonce': nonce,
                'gas': gas_estimate,
                'maxFeePerGas': max_fee_per_gas,
                'maxPriorityFeePerGas': max_priority_fee_per_gas
            })
            print(f'Transaction dict: {tx}')

            signed_tx = self.web3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)
            receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)

            print(f'Transaction successful with hash: {self.web3.to_hex(tx_hash)}')
            return receipt
        except Exception as e:
            print(f'Error storing hash: {e}')
            raise

    def is_hash_stored(self, hash_value):
        try:
            if isinstance(hash_value, str):
                hash_value = Web3.to_bytes(hexstr=hash_value)
            result = self.hash_store_contract.functions.isHashStored(hash_value).call()
            return result
        except Exception as e:
            print(f'Error checking if hash is stored: {e}')
            raise

    def get_user_by_hash(self, hash_value):
        try:
            if isinstance(hash_value, str):
                hash_value = Web3.to_bytes(hexstr=hash_value)
            user = self.hash_store_contract.functions.getUserByHash(hash_value).call()
            return user
        except Exception as e:
            print(f'Error getting user by hash: {e}')
            raise

    def get_hashes_by_user(self, user_address):
        try:
            hashes = self.hash_store_contract.functions.getHashesByUser(user_address).call()
            return [self.web3.to_hex(h) for h in hashes]
        except Exception as e:
            print(f'Error getting hashes by user: {e}')
            raise

    def get_my_hashes(self):
        try:
            hashes = self.hash_store_contract.functions.getMyHashes().call({'from': self.from_address})
            return [self.web3.to_hex(h) for h in hashes]
        except Exception as e:
            print(f'Error getting my hashes: {e}')
            raise

    def get_ipfs_by_hash(self, hash_value):
        try:
            if isinstance(hash_value, str):
                hash_value = Web3.to_bytes(hexstr=hash_value)
            ipfs_content_id = self.hash_store_contract.functions.getIpfsByHash(hash_value).call()
            return ipfs_content_id
        except Exception as e:
            print(f'Error getting IPFS content ID by hash: {e}')
            raise


class ACBCTokenSmartContract:
    def __init__(self, from_address=None, private_key=None):
        self.alchemy_api_key = os.getenv('ALCHEMY_API_KEY')
        self.web3 = Web3(Web3.HTTPProvider(f"https://eth-sepolia.g.alchemy.com/v2/{self.alchemy_api_key}"))
        if self.web3.is_connected():
            print('Connected to Sepolia testnet')
        else:
            raise ConnectionError('Failed to connect to Sepolia testnet')

        self.token_address = '0xD495Dc2fa8A9255a50d79eb8C1D5a234ef3e36De'
        self.token_contract_abi = acbc_token_abi
        self.token_contract = self.web3.eth.contract(address=self.token_address,
                                                     abi=self.token_contract_abi)
        if from_address:
            self.from_address = from_address
            self.balance = self.web3.eth.get_balance(from_address)
            print(f'Balance: {self.web3.from_wei(self.balance, "ether")} ETH')

        self.private_key = private_key

    def mint_tokens(self, to_address, amount):
        try:
            nonce = self.web3.eth.get_transaction_count(self.from_address)

            # Get the latest base fee
            latest_block = self.web3.eth.get_block('latest')
            base_fee_per_gas = latest_block['baseFeePerGas']
            max_priority_fee_per_gas = self.web3.to_wei('2', 'gwei')
            max_fee_per_gas = base_fee_per_gas + max_priority_fee_per_gas

            # Estimate gas
            gas_estimate = self.token_contract.functions.mint(to_address, amount).estimate_gas({
                'from': self.from_address,
                'nonce': nonce
            })

            print(f"Estimated Gas: {gas_estimate}")

            tx = self.token_contract.functions.mint(to_address, amount).build_transaction({
                'from': self.from_address,
                'nonce': nonce,
                'gas': gas_estimate,
                'maxFeePerGas': max_fee_per_gas,
                'maxPriorityFeePerGas': max_priority_fee_per_gas
            })

            signed_tx = self.web3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)
            receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)

            print(f'Transaction successful with hash: {self.web3.to_hex(tx_hash)}')
            return receipt
        except Exception as e:
            print(f'Error minting tokens: {e}')
            raise

    def burn_tokens(self, amount):
        try:
            nonce = self.web3.eth.get_transaction_count(self.from_address)

            # Get the latest base fee
            latest_block = self.web3.eth.get_block('latest')
            base_fee_per_gas = latest_block['baseFeePerGas']
            max_priority_fee_per_gas = self.web3.to_wei('2', 'gwei')
            max_fee_per_gas = base_fee_per_gas + max_priority_fee_per_gas

            # Estimate gas
            gas_estimate = self.token_contract.functions.burn(amount).estimate_gas({
                'from': self.from_address,
                'nonce': nonce
            })

            print(f"Estimated Gas: {gas_estimate}")

            tx = self.token_contract.functions.burn(amount).build_transaction({
                'from': self.from_address,
                'nonce': nonce,
                'gas': gas_estimate,
                'maxFeePerGas': max_fee_per_gas,
                'maxPriorityFeePerGas': max_priority_fee_per_gas
            })

            signed_tx = self.web3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)
            receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)

            print(f'Transaction successful with hash: {self.web3.to_hex(tx_hash)}')
            return receipt
        except Exception as e:
            print(f'Error burning tokens: {e}')
            raise

    def get_total_supply(self):
        try:
            total_supply = self.token_contract.functions.totalSupply().call()
            print(f'Total Supply: {total_supply}')
            return total_supply
        except Exception as e:
            print(f'Error getting total supply: {e}')
            raise
