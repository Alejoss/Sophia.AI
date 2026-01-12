import React, { useState } from 'react';
import { Grid, Paper, Container, Typography, Box } from '@mui/material';
import UploadContentForm from './UploadContentForm';
import RecentUserContent from './RecentUserContent';

const LibraryUploadContent = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleContentUploaded = (contentProfile) => {
    // Increment the refresh trigger to cause RecentUserContent to re-fetch
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Subir contenido
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Sube nuevo contenido y visualiza tus subidas recientes
        </Typography>
      </Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <UploadContentForm onContentUploaded={handleContentUploaded} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <RecentUserContent key={refreshTrigger} />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default LibraryUploadContent; 