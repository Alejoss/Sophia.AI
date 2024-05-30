const { runSandboxCode } = require("../utils/chainlinkFunctionUtils");
const { task } = require("hardhat/config");


task("simulate-script", "Deploys all our ecosystem")
    .addParam("sourceFilename", "The file whose code will be run")
    .addOptionalParam("configFilename", "The file with extra config (args, bytesArgs, secrets)")
    .setAction(async ({ sourceFilename, configFilename }, hre, runSuper) => {
        if (!sourceFilename) {
            console.error("The source file is unspecified");
            return;
        }

        try
        {
            console.log(await runSandboxCode(sourceFilename, configFilename));
        } catch(e)
        {
            console.error(e);
        }
    });