import ErrorLauncherContext from "./Errors/ErrorLauncherContext";
import ErrorNotification from "./Errors/ErrorNotification";
import Wrapper from "./Wrapping/Wrapper";
// import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Main from "./Content/Main";
import {useRef} from "react";

function App() {
    let chainId = parseInt(process.env.REACT_APP_CHAIN_ID);
    let chainName = process.env.REACT_APP_CHAIN_NAME;
    console.log(`Launching app for chain-id=[${chainId}] chain-name=[${chainName}]`);

    // One ref for the account picker.
    // This ref will hold a method: ref.current.refreshBalance().
    const errorDialogRef = useRef(null);

    return (
        <ErrorLauncherContext.Provider value={errorDialogRef}>
            <ErrorNotification ref={errorDialogRef} />
            <Wrapper expectedChainId={chainId} expectedChainName={chainName}>
                <Main />
            </Wrapper>
        </ErrorLauncherContext.Provider>
    );
}

export default App;
