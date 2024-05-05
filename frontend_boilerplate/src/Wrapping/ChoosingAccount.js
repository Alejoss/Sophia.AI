import AccountPicker from "./AccountPicker.js";
import {useState} from "react";
import Web3AccountContext from "./Web3AccountContext";


export default function ChoosingAccount({ web3, accounts, children }) {
    const [accountIndex, setAccountIndex] = useState(0);
    const [balanceRefresherObj, setBalanceRefresherObj] = useState({callback: () => {}});
    const setBalanceRefresher = (br) => setBalanceRefresherObj({callback: br});
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