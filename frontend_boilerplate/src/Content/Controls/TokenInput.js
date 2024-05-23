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

const decimalsMap = {
    wei: 0,
    kwei: 3, Kwei: 3, babbage: 3, femtoether: 3,
    mwei: 6, Mwei: 6, lovelace: 6, picoether: 6,
    gwei: 9, Gwei: 9, shannon: 9, nanoether: 9, nano: 9,
    szabo: 12, microether: 12, micro: 12,
    finney: 15, milliether: 15, milli: 15,
    ether: 18,
    kether: 21, grand: 21,
    mether: 24,
    gether: 27,
    tether: 30,
}

function parseUnit(value, decimals) {
    // This function assumes 'value' is a string representing a valid number
    // and 'decimals' is the number of decimal places to consider.
    let [integer, fraction = ''] = value.split('.');
    fraction = fraction.padEnd(decimals, '0'); // Extend the fraction to desired decimal places
    fraction = fraction.slice(0, decimals); // Ensure fraction is not longer than the decimals count

    // Combine the integer and adjusted fraction to form the complete number string
    const fullNumber = integer + fraction;
    // eslint-disable-next-line no-undef
    return BigInt(fullNumber); // Convert to BigInt
}

function dumpUnit(value, decimals) {
    // Convert BigInt to a string
    let strValue = value.toString();

    // Pad the string with zeros if it's shorter than the number of decimal places
    strValue = strValue.padStart(decimals + 1, '0');

    // Insert a decimal point at the correct position
    const index = strValue.length - decimals;
    let result = strValue.substring(0, index) + '.' + strValue.substring(index);

    // Normalize the result: remove unnecessary leading zeros and trailing zeros after the decimal point
    result = result.replace(/^0+/, ''); // Remove leading zeros
    if (decimals > 0) { // Only process trailing zeros if decimals were intended
        result = result.replace(/\.0+$|(\.\d*?[1-9])0+$/, '$1'); // Remove trailing zeros
    }

    // Handle special case where result is empty or just a dot left after trimming
    return result === '' || result === '.' ? '0' : result;
}

// Example usage:

function TokenInput({ value: initialWei, onChange, sx, variant = "outlined", unit = 'ether', ...props }) {
    // eslint-disable-next-line no-undef
    initialWei = BigInt(initialWei || 0); // Simplified check
    sx = sx || {};
    unit = parseInt(decimalsMap[unit] ?? unit);

    if (!Number.isInteger(unit) || unit < 0 || unit > 18) {
        throw new Error(`Invalid unit or decimals: ${unit}`);
    }

    const initialDisplayValue = dumpUnit(initialWei.toString(), unit);
    const [value, setValue] = useState(initialDisplayValue);

    useEffect(() => {
        setValue(initialDisplayValue);
    }, [initialDisplayValue, unit]);

    const handleChange = (event) => {
        const { value } = event.target;
        const sanitized = sanitizeInput(value);
        setValue(sanitized);
        const number = parseUnit(sanitized, unit);
        // eslint-disable-next-line no-undef
        onChange(BigInt(number));
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