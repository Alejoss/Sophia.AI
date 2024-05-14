const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("MockV3Aggregator", (m) => {
    const mock = m.contract(
        "MockV3Aggregator", [8, "65000000"]
    );
    return { mock };
});