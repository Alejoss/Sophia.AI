const fs = require('fs');
const { simulateScript } = require("@chainlink/functions-toolkit");


async function runSandboxCode(sourceFilename, configFilename) {
    const source = fs.readFileSync(sourceFilename, 'utf8');
    if (!source)
    {
        throw new Error("No source file contents");
    }

    let config = {args:[], bytesArgs:[], secrets:{}};
    try
    {
        if (configFilename) {
            config = JSON.parse(fs.readFileSync(configFilename, 'utf8'));
            config = {args: config.args || [], bytesArgs: config.bytesArgs || [], secrets: config.secrets || {}};
        }
    }
    catch(e)
    {
        console.error("Error loading the config file (no config will be used):");
        throw e;
    }

    return await simulateScript({
        "source": source, ...config
    });
}

module.exports = {
    runSandboxCode: runSandboxCode
}