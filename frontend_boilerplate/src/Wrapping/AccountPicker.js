import React, { useState, useEffect } from 'react';
import {Card, CardContent, MenuItem, Select} from "@mui/material";
import ConnectToWallet from "./ConnectToWallet";

export default function AccountPicker({ web3, accounts, accountIndex, setAccountIndex }) {
    const [balance, setBalance] = useState('0');

    // Effect to update balance when accountIndex changes
    useEffect(() => {
        // Function to fetch the balance of the selected account
        const fetchBalance = async (account) => {
            const weiBalance = await web3.eth.getBalance(account);
            const ethBalance = web3.utils.fromWei(weiBalance, 'ether');
            setBalance(ethBalance);
        };

        if (accounts.length > 0 && accountIndex < accounts.length) {
            fetchBalance(accounts[accountIndex]);
        }
    }, [web3, accountIndex, accounts]); // Depend on accountIndex and accounts

    // Handler for dropdown change
    const handleAccountChange = (event) => {
        const newIndex = parseInt(event.target.value, 10);
        setAccountIndex(newIndex);
    };

    return (
        <div style={{
            position: 'fixed',
            top: '10px',
            left: '10px',
        }}>
            <Card style={{ width: 'auto' }}>
                <CardContent>
                    {(accounts && accounts.length && (
                        <>
                            <Select size="small" sx={{ bgcolor: 'background.paper', marginRight: '10px', padding: '5px' }}
                                    value={accountIndex} onChange={handleAccountChange}>
                                {accounts.map((account, index) => (
                                    <MenuItem value={index} key={index}>{account}</MenuItem>
                                ))}
                            </Select>
                            <label style={{fontSize: '0.9rem'}}>
                                Balance: {balance} ETH
                            </label>
                        </>
                    )) || null}
                    <ConnectToWallet web3={web3} style={{marginLeft: '10px'}}/>
                </CardContent>
            </Card>
        </div>
    );
}