import React from 'react';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

function ProgressDialog({ open }) {
    return (
        <Backdrop
            sx={{
                color: '#fff',
                zIndex: 10000,
                backgroundColor: 'rgba(0, 0, 0, 0.125)'  // Gray color with alpha
            }}
            open={open}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column'
                }}
            >
                <CircularProgress color="inherit" />
            </Box>
        </Backdrop>
    );
}

export default ProgressDialog;
