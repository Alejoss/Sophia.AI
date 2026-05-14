import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Paper, Container, Typography, Box, Button, Stack } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import UploadContentForm from './UploadContentForm';
import RecentUserContent from './RecentUserContent';

const LibraryUploadContent = () => {
  const navigate = useNavigate();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleContentUploaded = (contentProfile) => {
    // Increment the refresh trigger to cause RecentUserContent to re-fetch
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="h4" sx={{ mb: 0 }}>
            Subir contenido
          </Typography>
          <Button
            variant="outlined"
            startIcon={<FolderOpenIcon />}
            onClick={() => navigate('/content/library_upload_folder')}
            sx={{ textTransform: 'none', alignSelf: { xs: 'stretch', sm: 'center' } }}
          >
            Subir carpeta
          </Button>
        </Stack>
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