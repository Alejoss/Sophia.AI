import React from 'react';
import { Grid } from '@mui/material';
import UploadContentForm from './UploadContentForm';
import './UploadContentLibrary.css';

const UploadContentLibrary = () => {
  return (
    <div className="upload-content-library">
      <h1>Upload Content</h1>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <UploadContentForm />
        </Grid>
      </Grid>
    </div>
  );
};

export default UploadContentLibrary; 