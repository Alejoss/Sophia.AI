const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("Params", (m) => {
    const addr = m.getParameter("priceFeed", "0x0");

    const params = m.contract(
        "ACBCSophiaAIParams", [addr]
    );

    return { params };
});
