const MockV3AggregatorModule = require("../ignition/modules/MockV3Aggregator");
const Params = require("../ignition/modules/Params");

async function main() {
    let addr;
    switch(hre.network.name) {
        case "hardhat":
        case "localhost":
            const { mock } = await hre.ignition.deploy(MockV3AggregatorModule);
            addr = await mock.getAddress();
            break;
        case "testnet":
            addr = "0x001382149eBa3441043c1c66972b4772963f5D43";
            break;
        case "mainnet":
            addr = "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0";
            break;
        default:
            throw new Error("Unknown network: " + hre.network.name);
    }
    await hre.ignition.deploy(Params, {
        parameters: {
            "Params": {
                "priceFeed": addr
            }
        }
    });
}
main().catch(console.error);