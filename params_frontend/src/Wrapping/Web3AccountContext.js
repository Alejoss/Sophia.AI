import { createContext } from 'react';

const Web3CAccountContext = createContext({
    account: "0x0", balanceRefresher: () => {}
});

export default Web3CAccountContext;