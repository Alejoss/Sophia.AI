import {useContext, useEffect, useMemo, useRef, useState} from "react";
import Web3Context from "../Wrapping/Web3Context";
import Web3AccountContext from "../Wrapping/Web3AccountContext";
import {Alert, AppBar, Button, Grid, IconButton, Paper, Toolbar, Typography} from "@mui/material";
import RefreshIcon from '@mui/icons-material/Refresh';
import MakeContractClient from './MakeContractClient';
import ErrorLauncherContext from "../Errors/ErrorLauncherContext";
import AddressInput from "./AddressInput";
import Section from "./Section";
import Label from "./Label";
import Heading from "./Heading";
import TokenInput from "./TokenInput";
import Web3 from "web3";

// Which are the defined params of the app?
const params = [
    // Define many costs like this:
    {
        caption: "Defining a World",
        hash: Web3.utils.soliditySha3("Costs::DefineWorld")
    }
];

/**
 * This is the main page. All the pages should look like this.
 * @returns {JSX.Element}
 */
export default function Main() {
    // Extract the context's relevant data to make transactions.
    const context = {...useContext(Web3Context), ...useContext(Web3AccountContext)};
    const { web3, account, balanceRefresher } = context;
    const errorLauncher = useContext(ErrorLauncherContext);

    // Is the contract deployed? Which address?
    const contract = MakeContractClient(web3, account);
    const isDeployed = contract !== null;

    // Which are the retrieved params of our app?
    const [ paramsData, setParamsData ] = useState({
        owner: "0x0",
        earningsReceiver: "0x0",
        // eslint-disable-next-line no-undef
        earningsBalance: BigInt(0),
        fiatCosts: {}, // Each key is a hash. Each value is value in USD.
        nativeCosts: {}, // Each key is a hash. Each value is value in ETH.
    });
    const ref_ = useRef({setParamsData: null, contract: null});
    ref_.current.setParamsData = setParamsData;
    ref_.current.contract = contract;
    const isOwner = paramsData.owner === account;
    const earningsReceiver = paramsData.earningsReceiver;
    const costParams = paramsData.fiatCosts;
    const setEarningsReceiver = (er) => {
        setParamsData({
            ...paramsData, earningsReceiver: er
        });
    }
    const setCostParam = (hash, value) => {
        let newFiatCosts = {...paramsData.fiatCosts};
        newFiatCosts[hash] = value;
        setParamsData({...paramsData, fiatCosts: newFiatCosts});
    }

    // eslint-disable-next-line no-undef
    const [ amountToWithdraw, setAmountToWithdraw] = useState(BigInt(0));

    // This refresh function returns EVERYTHING.
    const refresh = useMemo(() => errorLauncher.current.capturingError(async function() {
        if (!isDeployed) return;

        // First, update the balance.
        await balanceRefresher();

        const contract = ref_.current.contract;
        // Then, get the following elements:
        // - owner
        let owner = await contract.methods.owner().call();
        // - earningsBalance
        let earningsReceiver = await contract.methods.earningsReceiver().call();
        // - earningsReceiversent
        let earningsBalance = await contract.methods.earningsBalance().call();
        // - fiatCosts
        let fiatCosts = {};
        await Promise.all(params.map(async (e) => {
            fiatCosts[e.hash] = await contract.methods.fiatCosts(e.hash).call();
        }));
        // - native costs:
        let nativeCosts = {};
        await Promise.all(params.map(async (e) => {
            nativeCosts[e.hash] = await contract.methods.getNativeCost(e.hash).call();
        }));

        // Update everything.
        console.log("Setting refresh data...");
        ref_.current.setParamsData({owner, earningsReceiver, earningsBalance, fiatCosts, nativeCosts});
    }), [/* Intentionally empty, so the associated effect executes only once */]);

    function wrappedCall(f) {
        return async function(...args) {
            let result = f(...args);
            if (result instanceof Promise) result = await result;
            await refresh();
            return result;
        }
    }

    // This function sets the new earnings receiver.
    const updateEarningsReceiver = errorLauncher.current.capturingError(wrappedCall(async function() {
        await contract.methods.setEarningsReceiver(earningsReceiver).send();
    }));

    // This function withdraws an amount to the earnings receiver.
    const withdraw = errorLauncher.current.capturingError(wrappedCall(async function() {
        await contract.methods.earningsWithdraw(amountToWithdraw).send();
    }));

    // This function updates a cost parameter.
    const updateCostParameter = errorLauncher.current.capturingError(wrappedCall(async function(hash) {
        console.log("Hash:", hash);
        console.log("Values:", paramsData.fiatCosts[hash]);
        await contract.methods.setFiatCost(hash, paramsData.fiatCosts[hash]).send();
    }));

    // Force an initial refresh for our app.
    useEffect(() => {
        refresh();
    }, [refresh]);

    function abbr(address) {
        if (address.length > 21) {
            return address.slice(0, 10) + "..." + address.slice(address.length - 8)
        }
        return address;
    }

    return <Paper elevation={3} style={{ margin: '40px', marginTop: '120px', padding: '20px' }}>
        <AppBar position="static" color="primary">
            <Toolbar>
                <Typography variant="h6" style={{ flexGrow: 1 }}>
                    Stick 'em All - Management (Contract: {isDeployed ? abbr(contract.options.address) + "; Owner: " + abbr(paramsData.owner) : "not deployed yet"})
                </Typography>
                {(isDeployed ? (
                    <IconButton color="inherit" onClick={refresh}>
                        <RefreshIcon />
                    </IconButton>
                ) : null)}
            </Toolbar>
        </AppBar>

        <Alert severity="info" sx={{marginTop: 4}}>
            This section allows the contract owner to modify the business parameters.
            This involves management of ownership, earnings, and costs (expressed in USD).
        </Alert>
        {!isDeployed ? (
            <Alert severity="error">
                The contract is not deployed.
            </Alert>
        ) : (!isOwner ? (
            <Alert severity="error">
                You're not the owner of this contract. Only the owner of this contract can edit these fields.<br />
                Any attempt to make any change will fail. If you think this is an error / outdated, refresh the page.
            </Alert>
        ) : (
            <>
                <Alert severity="success">
                    You're the owner of this contract. You can change any of these parameters.
                </Alert>
                <Alert severity="warning">
                    These actions are dangerous, all of them. These can affect the entire business or make you lose the saved money.
                </Alert>
            </>
        ))}
        <Section title="Earnings management" color="primary.light">
            <Grid container>
                <Grid item xs={12}>
                    <Heading>Earnings Receiver</Heading>
                </Grid>
                <Grid item xs={2}>
                    <Label>Earnings Receiver:</Label>
                </Grid>
                <Grid item xs={10}>
                    <AddressInput value={earningsReceiver} onChange={setEarningsReceiver} />
                </Grid>
                <Grid item xs={12}>
                    <Button disabled={!contract} onClick={updateEarningsReceiver} variant="contained" color="primary" size="large">Update</Button>
                </Grid>

                <Grid item xs={12}>
                    <Heading>Withdraw (to address: {earningsReceiver})</Heading>
                </Grid>
                <Grid item xs={2}>
                    <Label>Amount (in MATIC):</Label>
                </Grid>
                <Grid item xs={10}>
                    <TokenInput value={amountToWithdraw} onChange={setAmountToWithdraw} />
                </Grid>
                <Grid item xs={12}>
                    <Button disabled={!contract} onClick={withdraw} variant="contained" color="primary" size="large">Withdraw</Button>
                </Grid>
            </Grid>
        </Section>
        <Section title="Cost parameters" color="primary.light">
            {params.map((p, idx) => (
                <Grid container key={idx}>
                    <Grid item xs={12}>
                        <Heading>{p.caption}</Heading>
                    </Grid>
                    <Grid item xs={3}>
                        <Label>Amount (in USD):</Label>
                    </Grid>
                    <Grid item xs={9}>
                        <TokenInput unit={2} value={costParams[p.hash]} onChange={(v) => setCostParam(p.hash, v)} />
                    </Grid>
                    <Grid item xs={3}>
                        <Label>Converted amount (in MATIC):</Label>
                    </Grid>
                    <Grid item xs={9}>
                        {/* eslint-disable-next-line no-undef */}
                        <Label sx={{textAlign: 'left'}}>{web3.utils.fromWei(paramsData.nativeCosts[p.hash] || BigInt(0), "ether")}</Label>
                    </Grid>
                    <Grid item xs={12}>
                        <Button disabled={!contract} onClick={() => updateCostParameter(p.hash)}
                                variant="contained" color="primary" size="large">Update</Button>
                    </Grid>
                </Grid>
            ))}
        </Section>
    </Paper>;
}