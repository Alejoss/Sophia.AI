import React from 'react';
import { Box, Card, Skeleton } from '@mui/material';

const ContentDetailSkeleton = () => (
  <Box sx={{ maxWidth: 800, margin: '0 auto', padding: 2, pt: 12 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
      <Skeleton variant="rounded" width={160} height={36} />
      <Skeleton variant="rounded" width={200} height={36} />
    </Box>
    <Card sx={{ padding: 3 }}>
      <Skeleton variant="text" width="70%" height={40} sx={{ mb: 2 }} />
      <Skeleton variant="rounded" width="100%" height={280} sx={{ mb: 2 }} />
      <Skeleton variant="text" width="90%" />
      <Skeleton variant="text" width="80%" />
      <Skeleton variant="text" width="60%" />
    </Card>
  </Box>
);

export default ContentDetailSkeleton;
