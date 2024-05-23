import {useContext, useEffect, useState} from "react";
import Web3Context from "../Wrapping/Web3Context";
import Web3AccountContext from "../Wrapping/Web3AccountContext";
import {Button, Grid} from "@mui/material";
import MakeContractClient from './MakeContractClient';
import AddressInput from "./Controls/AddressInput";
import Section from "./Controls/Section";
import Label from "./Controls/Label";
import Heading from "./Controls/Heading";
import TokenInput from "./Controls/TokenInput";
import ParamsAwareContractWindow from "./Windows/ParamsAwareContractWindow";
import Web3 from "web3";
import ParamsContext from "./Contexts/ParamsContext";
import ContractWindowContext from "./Contexts/ContractWindowContext";


const params = [
    // Define many costs like this:
    {
        caption: "Defining a World",
        hash: Web3.utils.soliditySha3("Costs::DefineWorld")
    },
    {
        caption: "Defining an Album",
        hash: Web3.utils.soliditySha3("Costs::Albums::DefineAlbum")
    },
    {
        caption: "Defining an Album's Page",
        hash: Web3.utils.soliditySha3("Costs::Albums::DefinePage")
    },
    {
        caption: "Defining an Achievement",
        hash: Web3.utils.soliditySha3("Costs::Albums::DefineAchievement")
    },
    {
        caption: "Defining a Sticker",
        hash: Web3.utils.soliditySha3("Costs::Albums::DefineSticker")
    },
];


// This is the content of the main app.
function MainContent() {
    const {paramsData, paramsContract} = useContext(ParamsContext);
    const {wrappedCall} = useContext(ContractWindowContext);

    // Handling changes in the current (non-committed) data.
    const [currentParamsData, setCurrentParamsData] = useState(paramsData);
    useEffect(() => {
        setCurrentParamsData(paramsData);
    }, [paramsData]);

    // For the costs.
    const setCostParam = (hash, value) => {
        let newFiatCosts = {...currentParamsData.fiatCosts};
        newFiatCosts[hash] = value;
        setCurrentParamsData({...currentParamsData, fiatCosts: newFiatCosts});
    }

    // For the receiver.
    const [newEarningsReceiver, setNewEarningsReceiver] = useState(currentParamsData.earningsReceiver);
    useEffect(() => {
        setNewEarningsReceiver(paramsData.earningsReceiver);
    }, [currentParamsData.earningsReceiver]);

    // eslint-disable-next-line no-undef
    const [amountToWithdraw, setAmountToWithdraw] = useState(BigInt(0));

    // This function sets the new earnings receiver.
    const updateEarningsReceiver = wrappedCall(async function() {
        await paramsContract.methods.setEarningsReceiver(newEarningsReceiver).send();
    });

    // This function withdraws an amount to the earnings receiver.
    const withdraw = wrappedCall(async function() {
        await paramsContract.methods.earningsWithdraw(amountToWithdraw).send();
    });

    // This function updates a cost parameter.
    const updateCostParameter = wrappedCall(async function(hash) {
        console.log("Hash:", hash);
        console.log("Values:", paramsData.fiatCosts[hash]);
        await paramsContract.methods.setFiatCost(hash, currentParamsData.fiatCosts[hash]).send();
    });

    const earningsReceiver = paramsData.earningsReceiver;
    const costParams = paramsData.fiatCosts;

    return <>
        <Section title="Earnings management" color="primary.light">
            <Grid container>
                <Grid item xs={12}>
                    <Heading>Earnings Receiver</Heading>
                </Grid>
                <Grid item xs={2}>
                    <Label>Earnings Receiver:</Label>
                </Grid>
                <Grid item xs={10}>
                    <AddressInput value={newEarningsReceiver} onChange={setNewEarningsReceiver} />
                </Grid>
                <Grid item xs={12}>
                    <Button disabled={!paramsContract} onClick={updateEarningsReceiver} variant="contained" color="primary" size="large">Update</Button>
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
                    <Button disabled={!paramsContract} onClick={withdraw} variant="contained" color="primary" size="large">Withdraw</Button>
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
                        <Label sx={{textAlign: 'left'}}>{Web3.utils.fromWei(paramsData.nativeCosts[p.hash] || BigInt(0), "ether")}</Label>
                    </Grid>
                    <Grid item xs={12}>
                        <Button disabled={!paramsContract} onClick={() => updateCostParameter(p.hash)}
                                variant="contained" color="primary" size="large">Update</Button>
                    </Grid>
                </Grid>
            ))}
        </Section>
    </>;
}


/**
 * This is the main page. All the pages should look like this.
 * @returns {JSX.Element}
 */
export default function Main() {
    const context = {...useContext(Web3Context), ...useContext(Web3AccountContext)};
    const {web3, account} = context;
    const contract = MakeContractClient(web3, account);
    const description =
        "This section allows the contract owner to modify the business parameters.\n" +
        "This involves management of ownership, earnings, and costs (expressed in USD)."
    return <ParamsAwareContractWindow caption={"Sophia.AI - Management"} description={description}
                                      paramsContract={contract} params={params}
                                      mainContract={contract} showOwner={true}>
        <MainContent />;
    </ParamsAwareContractWindow>;
}