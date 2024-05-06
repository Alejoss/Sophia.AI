import React, {forwardRef, useImperativeHandle, useState} from 'react';
import Snackbar from '@mui/material/Snackbar';

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
                    let result = f.apply(null, args);
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
            open={message != null}
            autoHideDuration={duration}  // Snackbar will auto close after 6000ms
            onClose={handleClose}
            message={message}
        />
    );
});

export default ErrorNotification;