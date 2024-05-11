const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("Params", (m) => {
    const addr = m.getParameter("priceFeed", "0x0");

    const params = m.contract(
        "SophiaAIParams", [addr]
    );

    return { params };
});
