import React, {forwardRef, useImperativeHandle, useState} from 'react';
import Snackbar from '@mui/material/Snackbar';
import {Alert} from "@mui/material";

const ErrorNotification = forwardRef(({ duration }, ref) => {
    const [message, setMessage] = useState('');
    duration = duration || 6000;

    useImperativeHandle(ref, () => ({
        triggerError: function(msg = "An unexpected error has occurred") {
            setMessage(msg);
        },
        capturingError: function(f) {
            return function(...args) {
                try {
                    let result = f(...args);
                    if (result instanceof Promise) {
                        return result.catch(function(e) {
                            console.error(e);
                            setMessage(e.toString());
                        });
                    }
                } catch(e) {
                    console.error(e);
                    setMessage(e.toString());
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
            autoHideDuration={duration}  // Snackbar will auto close after 6000ms
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