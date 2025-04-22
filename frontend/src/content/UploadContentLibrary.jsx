import React from 'react';
import { Grid } from '@mui/material';
import UploadContentForm from './UploadContentForm';
import ContentRecentlyUploaded from './ContentRecentlyUploaded';
import './UploadContentLibrary.css';

const UploadContentLibrary = () => {
  return (
    <div className="upload-content-library">
      <h1>Upload Content</h1>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <UploadContentForm />
        </Grid>
        <Grid item xs={12} md={4}>
          <ContentRecentlyUploaded />
        </Grid>
      </Grid>
    </div>
  );
};

export default UploadContentLibrary; 