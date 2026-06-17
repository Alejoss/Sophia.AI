import React from 'react';
import { Box, Grid, Paper, Skeleton } from '@mui/material';

const ProfileHeaderSkeleton = () => (
  <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Skeleton variant="circular" width={150} height={150} />
        </Box>
      </Grid>
      <Grid item xs={12} md={9}>
        <Skeleton variant="text" width="40%" height={48} sx={{ mb: 2 }} />
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="75%" />
      </Grid>
    </Grid>
  </Paper>
);

export default ProfileHeaderSkeleton;
