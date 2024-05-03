import AccountPicker from "./AccountPicker.js";
import {useState} from "react";
import Web3AccountContext from "./Web3AccountContext";


export default function ChoosingAccount({ web3, accounts, children }) {
    const [accountIndex, setAccountIndex] = useState(0);
    const account = ((!accounts || accountIndex >= accounts.length)
        ? "" : accounts[accountIndex])

    return <>
        <AccountPicker web3={web3} accounts={accounts} accountIndex={accountIndex} setAccountIndex={setAccountIndex} />
        <Web3AccountContext.Provider value={{account: account}}>
            {children}
        </Web3AccountContext.Provider>;
    </>;
}