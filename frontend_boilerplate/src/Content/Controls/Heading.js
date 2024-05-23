import {Typography} from "@mui/material";

const defaultSx = {paddingTop: 2, paddingBottom: 2, display: 'block', fontWeight: 'bold'};

function Heading({ sx, children, variant="h6", ...props }) {
    sx = {...defaultSx, ...sx};
    return <Typography sx={sx} {...props}>{children}</Typography>
}

export default Heading;