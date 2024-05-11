# Sophia.AI contracts

This contains the contracts that are related to the Sophia.AI project.

## Install everything

Run this command in a shell (the current directory must be the root of the project):

```shell
npm install
```

## Mounting the sample network

Run this command in a shell (the current directory must be the root of the project):

```shell
npx hardhat node
```

In another shell, run these commands:

```shell
# For the params and price feed:
npx hardhat run scripts/ParamsDeploy.js --network localhost
```

## Take notes of the deployed contracts' addresses

Either run this command:

```shell
npx hardhat ignition status chain-31337
```

and take notes of the addresses you care about (e.g. the address for the Params contract) or go to the
`ignition/deployments/chain-31337/artifacts` directory. This one will be created due to the previous deployment script.

Look for the `deployed_addresses.json` file and take notes of the addresses that are entry point contracts
(e.g. the address for the Params contract). You'll need to use them in front-end apps.

## Forward your network to https:// for MetaMask

Your network will run in localhost:8545 (chain ID: 31337), but you'll need to expose it through https.

My advice is like this:

  1. Create an account at [ngrok.com](https://ngrok.com).
  2. Go to the [domain](https://dashboard.ngrok.com/cloud-edge/domains) dashboard and create a FREE domain.
     - Let's say your free domain becomes your-awesome-domain.ngrok-free.app 
  3. Go to the [auth](https://dashboard.ngrok.com/get-started/your-authtoken) dashboard and copy your auth token.
     - Let's say your API key is: `7K79cBvZVo4jaDOHRpE86RmoHaD_2NDGNSn5GPEF1uivUeRQR`.
  4. [Install](https://ngrok.com/download) a ngrok client suitable for your OS.
  5. Run this command in a shell (with the appropriate key):

     ```shell
     ngrok config add-authtoken 7K79cBvZVo4jaDOHRpE86RmoHaD_2NDGNSn5GPEF1uivUeRQR
     ```

With everything setup, you can run this command in a shell (with the appropriate domain):

```shell
ngrok http --domain=your-awesome-domain.ngrok-free.app 8545
```

Then, configure the local network in MetaMask with the following data:

1. Any name for the network.
2. Symbol: GO (at least, MetaMask will not complain by choosing that symbol).
3. RPC: https://your-awesome-domain.ngrok-free.app.
4. Chain ID: 31337.
5. No block explorer.

## Fund your MetaMask account

For this project in particular, the seed is this:

```
dentist whale pattern drastic time black cigar bike person destroy punch hungry
```

And, as per the config, 100 accounts are instantiated with 10000 ETH each.
My advice is to:

1. Copy your address from your MetaMask (or whatever wallet you're using).
2. Run the following command to access a console against the hardhat node:

```shell
npx hardhat console --network localhost
```

And there:

```node
const mmAddr = "0xyourMetaMaskAddress";
const ctAddr = "0xyourContractAddress";
const last = (await ethers.getSigners())[99];
await last.sendTransaction({to: mmAddr, value: ethers.parseEther('100.0')});
```

Now you'll see 100 full coins in your MetaMask account in that network.

## Grant the ownership of the params to your MetaMask account

The console commands are:

```node
const Params = await ethers.getContractFactory("SophiaAIParams");
const contract = Params.attach(ctAddr); // Considering that you took notes of the deployed address
await contract.transferOwnership(mmAddr);
```