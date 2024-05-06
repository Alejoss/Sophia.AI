import AccountPicker from "./AccountPicker.js";
import {useRef, useState} from "react";
import Web3AccountContext from "./Web3AccountContext";


export default function ChoosingAccount({ web3, accounts, children }) {
    const [accountIndex, setAccountIndex] = useState(0);
    const account = ((!accounts || accountIndex >= accounts.length)
        ? "" : accounts[accountIndex]);

    // One ref for the account picker.
    // This ref will hold a method: ref.current.refreshBalance().
    const accountPickerRef = useRef();
    let balanceRefresher = accountPickerRef.current?.refreshBalance || (() => {});

    return <>
        <AccountPicker web3={web3} accounts={accounts} accountIndex={accountIndex} onAccountIndexChange={setAccountIndex}
                       ref={accountPickerRef} />
        <Web3AccountContext.Provider value={{account, balanceRefresher}}>
            {children}
        </Web3AccountContext.Provider>;
    </>;
}