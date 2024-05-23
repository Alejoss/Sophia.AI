import {useContext, useEffect, useMemo} from "react";
import {Alert, AppBar, IconButton, Paper, Toolbar, Typography} from "@mui/material";
import ErrorLauncherContext from "../../Errors/ErrorLauncherContext";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContractWindowContext from "../Contexts/ContractWindowContext";


/**
 * Abbreviates an address using ellipsis notation.
 * @param address The address to abbreviate.
 * @returns {string} The abbreviated address.
 */
function abbr(address) {
    if (address.length > 21) {
        return address.slice(0, 10) + "..." + address.slice(address.length - 8)
    }
    return address;
}


/**
 * This is a wrapper to create a contract-aware window.
 */
export default function ContractWindow({
    caption, description, mainContract, mainContractInfo, refresh, children
}) {
    // 1. Get the context-related utilities.
    const errorLauncher = useContext(ErrorLauncherContext);

    // 2. This wrapped call component wraps an action inside an error capture
    //    and a forced refresh. This utility is provided as a context for later.
    const wrappedCall = useMemo(() => ((f) => (
        errorLauncher.current.capturingError(async function(...args) {
            let result = f(...args);
            if (result instanceof Promise) result = await result;
            await refresh();
            return result;
        }
    ))), [errorLauncher, refresh]);

    // 3. Force a first refresh.
    useEffect(() => {
        refresh();
    }, [refresh]);

    return <Paper elevation={3} style={{ margin: '40px', marginTop: '120px', padding: '20px' }}>
        <AppBar position="static" color="primary">
            <Toolbar>
                <Typography variant="h6" style={{ flexGrow: 1 }}>
                    {caption}
                </Typography>
                {((mainContract !== null) ? (
                    <IconButton color="inherit" onClick={refresh}>
                        <RefreshIcon />
                    </IconButton>
                ) : null)}
            </Toolbar>
        </AppBar>

        <Alert severity="info" sx={{marginTop: 4}}>
            {description}
        </Alert>
        {mainContract === null ? (
            <Alert severity="error">
                The contract is not deployed.
            </Alert>
        ) : (
            <>
                <Alert severity="info">
                    The contract is deployed at {abbr(mainContract.options.address)}
                </Alert>
                {mainContractInfo}
            </>
        )}
        <ContractWindowContext.Provider value={{wrappedCall, mainContract}}>
            {children}
        </ContractWindowContext.Provider>
    </Paper>;
}