import React from 'react';
import { Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';

function ThemedPaper({ color, children, sx, ...props }) {
    const theme = useTheme(); // Hook to access the theme
    sx = sx || {}

    // Determine the background and text color based on the
    // provided color prop.
    const backgroundColor = theme.palette[color]?.main || theme.palette.grey[200];
    const textColor = theme.palette[color]?.contrastText || theme.palette.getContrastText(theme.palette.grey[200]);

    return (
        <Paper
            sx={{
                padding: 2,
                backgroundColor: backgroundColor,
                color: textColor,
                ...sx,
            }}

            {...props}
        >
            {children}
        </Paper>
    );
}

export default ThemedPaper;
