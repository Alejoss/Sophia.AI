import { createContext } from 'react';

const ParamsContext = createContext({
    paramsData: {
        owner: "0x0",
        // eslint-disable-next-line no-undef
        earningsBalance: BigInt(0),
        fiatCosts: {}, // Each key is a hash. Each value is value in USD.
        nativeCosts: {}, // Each key is a hash. Each value is value in ETH.
    },
    paramsContract: null
});

export default ParamsContext;