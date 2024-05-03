import React, { useState, useEffect } from 'react';
import {Card, CardContent} from "@mui/material";
import ConnectToWallet from "./ConnectToWallet";

export default function AccountPicker({ web3, accounts, accountIndex, setAccountIndex }) {
    const [balance, setBalance] = useState('0');

    // Function to fetch the balance of the selected account
    const fetchBalance = async (account) => {
        const weiBalance = await web3.eth.getBalance(account);
        const ethBalance = web3.utils.fromWei(weiBalance, 'ether');
        setBalance(ethBalance);
    };

    // Effect to update balance when accountIndex changes
    useEffect(() => {
        if (accounts.length > 0 && accountIndex < accounts.length) {
            fetchBalance(accounts[accountIndex]);
        }
    }, [accountIndex, accounts]); // Depend on accountIndex and accounts

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
                            <select onChange={handleAccountChange} value={accountIndex}
                                    style={{padding: '5px', marginRight: '10px'}}>
                                {accounts.map((account, index) => (
                                    <option key={account} value={index}>
                                        {account}
                                    </option>
                                ))}
                            </select>
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