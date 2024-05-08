import React, { useState, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import Web3 from 'web3';

function sanitizeInput(input) {
    // Step 1: Remove all characters except digits and dot
    let sanitized = input.replace(/[^0-9.]/g, '');

    // Step 2: Remove all dots beyond the first
    let parts = sanitized.split('.');
    if (parts.length > 1) {
        sanitized = parts.shift() + '.' + parts.join('');
    }

    // Step 3: Replace empty string with "0"
    if (sanitized === '' || sanitized === '.') {
        sanitized = '0';
    }

    return sanitized;
}

function TokenInput({ value: initialWei, onChange, sx, variant = "outlined", unit = 'ether', ...props }) {
    // eslint-disable-next-line no-undef
    initialWei = (initialWei instanceof BigInt) ? initialWei : BigInt(0);
    sx = sx || {};
    const [value, setValue] = useState('');

    // Convert Wei to Ether for display
    useEffect(() => {
        const etherValue = Web3.utils.fromWei(initialWei.toString(), unit);
        setValue(etherValue);
    }, [initialWei, unit]);

    const handleChange = (event) => {
        const { value } = event.target;
        const sanitized = sanitizeInput(value);
        setValue(sanitized);
        // eslint-disable-next-line no-undef
        const number = BigInt(Web3.utils.toWei(sanitized, unit));
        onChange(number);
    };

    return (
        <TextField
            type="text"
            variant={variant}
            value={value}
            onChange={handleChange}
            sx={{...sx}}
            {...props}
        />
    );
}

export default TokenInput;