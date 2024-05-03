import { createContext } from 'react';

const Web3Context = createContext({
    web3: null, accounts: []
});

export default Web3Context;