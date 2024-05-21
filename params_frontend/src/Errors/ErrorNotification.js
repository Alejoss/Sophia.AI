import React, {forwardRef, useImperativeHandle, useState} from 'react';
import Snackbar from '@mui/material/Snackbar';
import {Alert} from "@mui/material";

const ErrorNotification = forwardRef(({ dialogDuration, setInProgress }, ref) => {
    const [message, setMessage] = useState('');
    dialogDuration = dialogDuration || 6000;

    useImperativeHandle(ref, () => ({
        triggerError: function(msg = "An unexpected error has occurred") {
            setMessage(msg);
        },
        capturingError: function(f) {
            return function(...args) {
                let shouldDoFinally = true;
                try {
                    console.log("Setting inProgress=true");
                    setInProgress(true);
                    console.log("Starting logic");
                    let result = f(...args);
                    if (result instanceof Promise) {
                        shouldDoFinally = false;
                        return (async function() {
                            try
                            {
                                return await result;
                            }
                            catch(e)
                            {
                                console.error(e);
                                setMessage(e.toString());
                            }
                            finally
                            {
                                console.log("Finishing logic with inProgress=false");
                                setInProgress(false);
                            }
                        })();
                    }
                } catch(e) {
                    console.error(e);
                    setMessage(e.toString());
                } finally {
                    if (shouldDoFinally) {
                        console.log("Finishing logic with inProgress=false");
                        setInProgress(false);
                    }
                }
            }
        }
    }));

    const handleClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setMessage('');
    };

    return (
        <Snackbar
            open={!!message}
            autoHideDuration={dialogDuration}  // Snackbar will auto close after 6000ms
            onClose={handleClose}
            message={message}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
            <Alert
                onClose={handleClose}
                severity="error"
                variant="filled"
                sx={{ width: '100%' }}
            >
                {message}
            </Alert>
        </Snackbar>
    );
});

export default ErrorNotification;
