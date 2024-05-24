import {useContext, useMemo, useState} from "react";
import {Alert, AppBar, IconButton, Paper, Toolbar, Typography} from "@mui/material";
import Web3Context from "../../Wrapping/Web3Context";
import Web3AccountContext from "../../Wrapping/Web3AccountContext";
import ErrorLauncherContext from "../../Errors/ErrorLauncherContext";
import ParamsContext from "../Contexts/ParamsContext";
import ContractWindow from "./ContractWindow";


/**
 * Abbreviates an address using ellipsis notation.
 * @param address The address to abbreviate.
 * @returns {string} The abbreviated address.
 */
function abbr(address) {
    if (address.length > 21) {
        return address.slice(0, 10) + "..." + address.slice(address.length - 8)
    }
    return address;
}


/**
 * This is a wrapper to create a params & contract-aware window.
 */
export default function ParamsAwareContractWindow({
    caption, description, mainContract, paramsContract, params, showOwner, children
}) {
    // 1. Get the context-related utilities.
    const context = {...useContext(Web3Context), ...useContext(Web3AccountContext)};
    const errorLauncher = useContext(ErrorLauncherContext);
    const {account, web3, balanceRefresher} = context;

    // 2. Prepare the params data.
    const [paramsData, setParamsData] = useState({
        owner: "0x0",
        // eslint-disable-next-line no-undef
        earningsBalance: BigInt(0),
        fiatCosts: {}, // Each key is a hash. Each value is value in USD.
        nativeCosts: {}, // Each key is a hash. Each value is value in ETH.
    });
    const isOwner = paramsData.owner === account;

    // 3. Make the refresh function (depends on context elements, the params
    //    setter, and the params contract & spec props).
    const refresh = useMemo(() => errorLauncher.current.capturingError(async function() {
        if (paramsContract === null) return;

        // First, update the balance.
        await balanceRefresher();

        // Then, get the following elements:
        // - owner
        let owner = await paramsContract.methods.owner().call();
        // - earningsReceiver
        let earningsReceiver = await paramsContract.methods.earningsReceiver().call();
        // - earningsBalance
        let earningsBalance = await web3.eth.getBalance(paramsContract.options.address);
        // - fiatCosts
        let fiatCosts = {};
        await Promise.all(params.map(async (e) => {
            fiatCosts[e.hash] = await paramsContract.methods.fiatCosts(e.hash).call();
        }));
        // - native costs:
        let nativeCosts = {};
        await Promise.all(params.map(async (e) => {
            nativeCosts[e.hash] = await paramsContract.methods.getNativeCost(e.hash).call();
        }));

        // Update everything.
        console.log("Setting refresh data...");
        setParamsData({owner, earningsReceiver, earningsBalance, fiatCosts, nativeCosts});
    }), [paramsContract, params, web3, balanceRefresher, errorLauncher, setParamsData]);

    const contractInfo = (
        !showOwner ? null : !isOwner ? (
            <Alert severity="error">
                You're not the owner of this contract. Only the owner of this contract can edit these fields.<br />
                Any attempt to make any change will fail. If you think this is an error / outdated, refresh the page.
            </Alert>
        ) : (
            <>
                <Alert severity="success">
                    You're the owner of this contract.
                </Alert>
                <Alert severity="warning">
                    These actions are dangerous, all of them. These can affect the entire business or make you
                    lose the saved money.
                </Alert>
            </>
        )
    );

    let extraCaption = (
        !showOwner ? "" :
        mainContract === null ? "not deployed yet" :
        `(Owner: ${abbr(paramsData.owner)})`
    );

    return <ContractWindow caption={`${caption} ${extraCaption}`} description={description}
                           mainContract={mainContract} mainContractInfo={contractInfo} refresh={refresh}>
        <ParamsContext.Provider value={{paramsData, paramsContract}}>
            {children}
        </ParamsContext.Provider>
    </ContractWindow>
}