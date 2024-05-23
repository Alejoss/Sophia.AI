import {Box, Paper, Toolbar, Typography} from "@mui/material";
import ThemedPaper from "./ThemedPaper";


function Section({ title, children, titleColor, sx }) {
    sx = sx || {};

    return (
        <Paper sx={{ elevation: 1, ...sx }}>
            <ThemedPaper color={titleColor} sx={{
                width: 'auto', marginTop: 2, padding: 0, elevation: 0,
                borderRadius: 0, boxShadow: 'none'
            }}> {/* Adjust width as needed */}
                <Toolbar>
                    <Typography variant="h6" noWrap>
                        {title}
                    </Typography>
                </Toolbar>
            </ThemedPaper>
            <Box sx={{ padding: 3 }}>
                {children}
            </Box>
        </Paper>
    );
}

export default Section;