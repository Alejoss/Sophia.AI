import {useContext, useState} from "react";
import Web3Context from "../Wrapping/Web3Context";
import Web3AccountContext from "../Wrapping/Web3AccountContext";
import {Alert, AppBar, IconButton, Paper, Toolbar, Typography} from "@mui/material";
import RefreshIcon from '@mui/icons-material/Refresh';
import MakeContractClient from './MakeContractClient';
import InfoIcon from '@mui/icons-material/Info';
import ErrorLauncherContext from "../Errors/ErrorLauncherContext";

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

    const contract = MakeContractClient(web3);
    const isDeployed = contract !== null;
    const [ paramsData, setParamsData ] = useState({
        owner: "0x0",
        earningsReceiver: "0x0",
        // eslint-disable-next-line no-undef
        earningsBalance: BigInt(0),
        fiatCosts: {}, // Each key is a hash. Each value is an object {native: '0.0', usd: '0.0'}
    });
    const isOwner = paramsData.owner === account;
    const params = [
        // Define many costs like this:
        {
            caption: "Defining a World",
            hash: web3.utils.soliditySha3("Costs::DefineWorld")
        }
    ];

    const refresh = errorLauncher.current.capturingError(async function() {
        // First, update the balance.
        await balanceRefresher();

        // Then, get the following elements:
        // - owner
        let owner = await contract.methods.owner().call();
        // - earningsBalance
        let earningsReceiver = await contract.methods.earningsReceiver().call();
        // - earningsReceiver
        let earningsBalance = await contract.methods.earningsBalance().call();
        // - fiatCosts
        let fiatCosts = {};
        await Promise.all(params.map(async (e) => {
            fiatCosts[e] = await contract.methods.fiatCosts(e.hash).call();
        }));

        // Update everything.
        console.log("Setting refresh data...");
        setParamsData({owner, earningsReceiver, earningsBalance, fiatCosts});
    });

    return <Paper elevation={3} style={{ margin: '40px', marginTop: '120px', padding: '20px' }}>
        <AppBar position="static" color="primary">
            <Toolbar>
                <Typography variant="h6" style={{ flexGrow: 1 }}>
                    Sophia.AI - Management (Contract: {isDeployed ? contract.options.address : "not deployed yet"})
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
        {!isOwner ? (
            <Alert severity="error">
                You're not the owner of this contract. Only the owner of this contract can edit these fields.
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
        )}
        {/* Placeholder for further content */}
    </Paper>;
}