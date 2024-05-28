from web3 import Web3


def generate_ethereum_account():
    web3 = Web3()
    account = web3.eth.account.create()
    private_key = account._private_key.hex()
    address = account.address
    return private_key, address


# Generate a new account
private_key, address = generate_ethereum_account()
print(f'Private Key: {private_key}')
print(f'Address: {address}')
