import AccountPicker from "./AccountPicker.js";
import {useMemo, useRef, useState} from "react";
import Web3AccountContext from "./Web3AccountContext";


export default function ChoosingAccount({ web3, accounts, children }) {
    const [accountIndex, setAccountIndex] = useState(0);
    const [balanceRefresherObj, setBalanceRefresherObj] = useState({callback: () => {}});
    const setBalanceRefresherRef = useRef(null);
    setBalanceRefresherRef.callback = (br) => setBalanceRefresherObj({callback: br});
    const setBalanceRefresher = useMemo(function() {
        return (br) => { setBalanceRefresherRef.callback(br); }
    }, [setBalanceRefresherRef]);
    const account = ((!accounts || accountIndex >= accounts.length)
        ? "" : accounts[accountIndex]);

    return <>
        <AccountPicker web3={web3} accounts={accounts} accountIndex={accountIndex} setAccountIndex={setAccountIndex}
                       balanceRefresher={balanceRefresherObj.callback} setBalanceRefresher={setBalanceRefresher} />
        <Web3AccountContext.Provider value={{account: account, balanceRefresher: balanceRefresherObj.callback}}>
            {children}
        </Web3AccountContext.Provider>;
    </>;
}