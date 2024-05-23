import { createContext } from 'react';

const ContractWindowContext = createContext({
    wrappedCall: (f) => f,
    mainContract: null
});

export default ContractWindowContext;