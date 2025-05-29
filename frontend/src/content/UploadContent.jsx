import React from 'react';
import { Grid, Paper, Container, Typography, Box } from '@mui/material';
import UploadContentForm from './UploadContentForm';
import RecentUserContent from './RecentUserContent';

const UploadContent = ({ onContentUploaded }) => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Upload Content
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Upload new content and view your recent uploads
        </Typography>
      </Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <UploadContentForm onContentUploaded={onContentUploaded} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <RecentUserContent />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default UploadContent; 