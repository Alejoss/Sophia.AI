import ErrorLauncherContext from "./Errors/ErrorLauncherContext";
import ErrorNotification from "./Errors/ErrorNotification";
import Wrapper from "./Wrapping/Wrapper";
// import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Main from "./Content/Main";
import {useRef, useState} from "react";
import ProgressDialog from "./Progress/ProgressDialog";

function App() {
    let chainId = parseInt(process.env.REACT_APP_CHAIN_ID);
    let chainName = process.env.REACT_APP_CHAIN_NAME;
    console.log(`Launching app for chain-id=[${chainId}] chain-name=[${chainName}]`);

    const [inProgress, setInProgress] = useState(false);
    console.log("In Progress:", inProgress);

    // One ref for the account picker.
    // This ref will hold a method: ref.current.refreshBalance().
    const errorDialogRef = useRef(null);

    return (
        <ErrorLauncherContext.Provider value={errorDialogRef}>
            <ErrorNotification ref={errorDialogRef} setInProgress={setInProgress} />
            <Wrapper expectedChainId={chainId} expectedChainName={chainName}>
                <Main />
            </Wrapper>
            <ProgressDialog open={inProgress} />
        </ErrorLauncherContext.Provider>
    );
}

export default App;
