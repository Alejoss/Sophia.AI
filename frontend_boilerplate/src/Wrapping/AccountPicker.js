import React, { useState, useEffect } from 'react';
import {Card, CardContent, IconButton, MenuItem, Select, Typography} from "@mui/material";
import ConnectToWallet from "./ConnectToWallet";
import RefreshIcon from "@mui/icons-material/Refresh";

export default function AccountPicker({
    web3, accounts, accountIndex, setAccountIndex, balanceRefresher, setBalanceRefresher
}) {
    const [balance, setBalance] = useState('0');

    // Effect to update balance when accountIndex changes
    useEffect(() => {
        // Function to fetch the balance of the selected account
        const fetchBalance = async (account) => {
            console.log(`>>> Refreshing balance for account ${account}...`);
            const weiBalance = await web3.eth.getBalance(account);
            const ethBalance = web3.utils.fromWei(weiBalance, 'ether');
            console.log(`<<< Account balance is: ${ethBalance}`);
            setBalance(ethBalance);
        };

        if (accounts.length > 0 && accountIndex < accounts.length) {
            setBalanceRefresher(() => fetchBalance(accounts[accountIndex]))
            fetchBalance(accounts[accountIndex]);
        }
    }, [web3, accountIndex, accounts, setBalanceRefresher]); // Depend on accountIndex and accounts

    // Handler for dropdown change
    const handleAccountChange = (event) => {
        const newIndex = parseInt(event.target.value, 10);
        setAccountIndex(newIndex);
    };

    return (
        <Card style={{ width: 'auto', position: 'fixed', top: '10px', left: '10px' }}>
            <CardContent>
                {(accounts && accounts.length && (
                    <>
                        <Select size="small" sx={{ bgcolor: 'background.paper', marginRight: '10px', padding: '5px' }}
                                value={accountIndex} onChange={handleAccountChange}>
                            {accounts.map((account, index) => (
                                <MenuItem value={index} key={index}>{account}</MenuItem>
                            ))}
                        </Select>
                        <Typography sx={{display: 'inline'}}>
                            Balance: {balance} ETH
                        </Typography>
                        <IconButton onClick={balanceRefresher}>
                            <RefreshIcon />
                        </IconButton>
                    </>
                )) || null}
                <ConnectToWallet web3={web3} style={{marginLeft: '10px'}}/>
            </CardContent>
        </Card>
    );
}