import os
from web3 import Web3
from content.contract_abis import acbc_token_abi, acbc_token_bytecode


def deploy_contract():
    alchemy_api_key = os.getenv('ALCHEMY_API_KEY')
    if not alchemy_api_key:
        raise ValueError("ALCHEMY_API_KEY environment variable not set")
    alchemy_url = f"https://eth-sepolia.g.alchemy.com/v2/{alchemy_api_key}"
    print(f"Connecting to Alchemy URL: {alchemy_url}")

    web3 = Web3(Web3.HTTPProvider(alchemy_url))
    if not web3.is_connected():
        raise ConnectionError("Failed to connect to Sepolia testnet")

    print("Connected to Sepolia testnet")

    private_key = os.getenv("SEPOLIA_PRIVATE_KEY")
    if not private_key:
        raise ValueError("SEPOLIA_PRIVATE_KEY environment variable not set")
    from_address = os.getenv("SEPOLIA_ACBCTOKEN_CONTRACT_ADDRESS")
    if not from_address:
        raise ValueError("SEPOLIA_ACBCTOKEN_CONTRACT_ADDRESS environment variable not set")

    print(f"Using from_address: {from_address}")

    abi = acbc_token_abi
    bytecode = "0x" + acbc_token_bytecode

    # print(f"ABI: {abi}")
    # print(f"Bytecode: {bytecode}")

    ACBCToken = web3.eth.contract(abi=abi, bytecode=bytecode)

    nonce = web3.eth.get_transaction_count(from_address)
    print(f"Nonce: {nonce}")

    tx = ACBCToken.constructor(from_address).build_transaction({
        'from': from_address,
        'nonce': nonce,
        'gas': 2000000,
        'maxFeePerGas': web3.to_wei('10', 'gwei'),  # Increased gas price
        'maxPriorityFeePerGas': web3.to_wei('2', 'gwei')
    })

    print(f"Transaction: {tx}")

    signed_tx = web3.eth.account.sign_transaction(tx, private_key)
    print(f"Signed Transaction: {signed_tx}")

    tx_hash = web3.eth.send_raw_transaction(signed_tx.rawTransaction)
    print(f"Transaction Hash: {web3.to_hex(tx_hash)}")

    try:
        receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)  # Increased timeout to 300 seconds
        print(f"Contract deployed at address: {receipt.contractAddress}")
    except web3.exceptions.TimeExhausted:
        print(f"Transaction {web3.to_hex(tx_hash)} is not in the chain after 300 seconds")
        print("Please check the transaction status manually on Etherscan")


if __name__ == "__main__":
    deploy_contract()
