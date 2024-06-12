from web3 import Web3


def generate_ethereum_account():
    web3 = Web3()
    account = web3.eth.account.create()
    private_key = account._private_key.hex()
    address = account.address
    return private_key, address



