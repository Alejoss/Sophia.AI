import React from 'react';
import { Box, Container, Paper, Skeleton } from '@mui/material';

const KnowledgePathDetailSkeleton = () => (
  <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
    <Paper elevation={3} sx={{ mb: 4, borderRadius: 3, overflow: 'hidden' }}>
      <Skeleton variant="rectangular" height={300} />
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width="60%" height={48} sx={{ mb: 1 }} />
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="80%" />
      </Box>
    </Paper>
    <Skeleton variant="rounded" height={120} sx={{ mb: 2 }} />
    <Skeleton variant="rounded" height={80} />
  </Container>
);

export default KnowledgePathDetailSkeleton;
