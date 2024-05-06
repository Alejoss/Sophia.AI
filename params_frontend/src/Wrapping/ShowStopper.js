import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';

/**
 * A show-stopper message. Nothing else can be done until refresh.
 * @param title The title.
 * @param content The content.
 */
const ShowStopper = ({title, content}) => {
    const containerStyle = {
        display: 'flex',        // Enables flexbox
        justifyContent: 'center',  // Centers horizontally
        alignItems: 'center',   // Centers vertically
        position: 'fixed',      // Fixed position
        top: 0,                 // Start from top edge
        left: 0,                // Start from left edge
        width: '100%',          // Full width
        height: '100%',         // Full height
        zIndex: 1000            // Ensures it's on top
    };

    return (
        <div style={containerStyle}>
            <Card style={{ width: 400 }}>
                <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                        {title}
                    </Typography>
                    <Typography variant="body2" style={{textAlign: 'center'}}>
                        {content}
                    </Typography>
                </CardContent>
            </Card>
        </div>
    );
}

export default ShowStopper;