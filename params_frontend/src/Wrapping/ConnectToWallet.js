import React from 'react';
import {Button} from "@mui/material";

const ConnectToWallet = ({ web3, style }) => {
    const connectWalletHandler = async () => {
        try {
            // Request account access
            await web3.currentProvider.request({
                method: 'eth_requestAccounts'
            });
        } catch (error) {
            console.error("An error occurred trying to connect this site to a wallet", error);
        }
    };

    return (
        <Button onClick={connectWalletHandler} variant="contained" color="info" size="small" style={style}>Use Wallet</Button>
    );
};

export default ConnectToWallet;