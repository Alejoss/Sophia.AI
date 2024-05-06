import React, { useState } from 'react';
import { TextField, IconButton, Tooltip } from '@mui/material';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import ClearIcon from '@mui/icons-material/Clear';
import Web3 from 'web3';

function AddressInput({value, onChange}) {
    const [address, setAddress] = useState(value || "0x0");
    const [error, setError] = useState('');
    const [tooltipOpen, setTooltipOpen] = useState(false);

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            const trimmedText = text.trim();

            if (trimmedText === '') {
                return; // Stop silently if trimmed text is empty
            }

            if (!Web3.utils.isAddress(trimmedText)) {
                setError('Not a valid checksum address');
                setTooltipOpen(true); // Show the tooltip with the error
                return;
            }

            setAddress(trimmedText); // Set the trimmed text as the new value
            onChange(trimmedText); // Set the trimmed text as the new value
            setError(''); // Clear any previous errors
            setTooltipOpen(false); // Close the tooltip if open
        } catch (error) {
            setError('Failed to read from clipboard');
            setTooltipOpen(true);
        }
    };

    const handleClear = () => {
        onChange('0x0'); // Reset to default address
        setAddress('0x0'); // Reset to default address
        setError(''); // Clear any errors
        setTooltipOpen(false); // Close the tooltip if open
    };

    // Function to manually close the tooltip
    const handleCloseTooltip = () => {
        setTooltipOpen(false);
    };

    return (
        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
            <Tooltip
                title={error}
                open={tooltipOpen}
                onClose={handleCloseTooltip}
                leaveDelay={2000}  // Optional: delay in milliseconds before tooltip closes
            >
                <TextField
                    value={address}
                    readOnly
                    variant="outlined"
                    error={!!error}
                    onClick={handleCloseTooltip}  // Close tooltip when the text field is clicked
                />
            </Tooltip>
            <IconButton onClick={handlePaste} color="primary">
                <ContentPasteIcon />
            </IconButton>
            <IconButton onClick={handleClear} color="secondary">
                <ClearIcon />
            </IconButton>
        </div>
    );
}

export default AddressInput;