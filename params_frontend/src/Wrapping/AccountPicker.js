import React, {useState, useMemo, forwardRef, useImperativeHandle, useEffect, useContext} from 'react';
import {Card, CardContent, IconButton, MenuItem, Select, Typography} from "@mui/material";
import ConnectToWallet from "./ConnectToWallet";
import RefreshIcon from "@mui/icons-material/Refresh";
import ErrorLauncherContext from "../Errors/ErrorLauncherContext";

const AccountPicker = forwardRef(({
                                      web3, accounts, accountIndex, onAccountIndexChange
                                  }, ref) => {
    // eslint-disable-next-line no-undef
    const [balance, setBalance] = useState(BigInt('0'));
    const errorLauncher = useContext(ErrorLauncherContext);

    // We'll compute a function for when the accountIndex is set.
    // We'll set this function in the setBalanceRefresher state,
    // so it can be used in other components later.
    const refreshBalance = useMemo(function() {
        if (accounts.length > 0 && accountIndex < accounts.length) {
            const account = accounts[accountIndex];
            return errorLauncher.current.capturingError(async () => {
                console.log(`>>> Refreshing balance for account ${account}...`);
                const weiBalance = await web3.eth.getBalance(account);
                const ethBalance = web3.utils.fromWei(weiBalance, 'ether');
                console.log(`<<< Account balance is: ${ethBalance}`);
                setBalance(ethBalance);
            });
        } else {
            return () => {};
        }
    }, [web3, accounts, accountIndex, setBalance, errorLauncher]);

    useImperativeHandle(ref, () => {
        return { refreshBalance }
    }, [refreshBalance]);

    useEffect(() => {
        refreshBalance();
    }, [refreshBalance]);

    // Handler for dropdown change
    const handleAccountChange = (event) => {
        const newIndex = parseInt(event.target.value, 10);
        onAccountIndexChange(newIndex);
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
                            Balance: {balance.toString()} ETH
                        </Typography>
                        <IconButton onClick={refreshBalance}>
                            <RefreshIcon />
                        </IconButton>
                    </>
                )) || null}
                <ConnectToWallet web3={web3} style={{marginLeft: '10px'}}/>
            </CardContent>
        </Card>
    );
});

export default AccountPicker;