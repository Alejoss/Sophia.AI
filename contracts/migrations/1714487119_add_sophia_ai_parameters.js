const ChainLinkMaticUsdLocalMock = artifacts.require("ChainLinkMaticUsdLocalMock");
const SophiaAIParams = artifacts.require("SophiaAIParams");


module.exports = async function(_deployer, network) {
    let deployedAddress;

    switch(network) {
        case "develop":
        case "development":
            // We'll deploy our own mock contract.
            await _deployer.deploy(ChainLinkMaticUsdLocalMock)
            deployedAddress = await ChainLinkMaticUsdLocalMock.deployed().address;
            break;
        case "mainnet":
            // We'll make use of a specific address.
            deployedAddress = "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0";
            break;
        case "testnet":
            // We'll make use of a specific address.
            deployedAddress = "0x001382149eBa3441043c1c66972b4772963f5D43";
            break;
        default:
            throw new Error("Unknown error: " + network + ". Please, set up a proper address for it");
    }
    await _deployer.deploy(SophiaAIParams);
};
