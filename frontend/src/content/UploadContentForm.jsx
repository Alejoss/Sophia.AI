import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import axiosInstance from '../api/axiosConfig';  // Import our configured instance
import { Grid } from '@mui/material';
import ContentRecentlyUploaded from './ContentRecentlyUploaded';

const schema = yup.object().shape({
  // TODO, only the image files have author and title as optional fields
  file: yup
    .mixed()
    .required('File is required'),

  title: yup.string().max(100, 'Title must not exceed 100 characters'),
  author: yup.string().max(100, 'Author must not exceed 100 characters'),
  personalNote: yup
    .string()
    .max(500, 'Personal note must not exceed 500 characters'),
});

const getMediaType = (file) => {
  if (!file || !file.type) return null;
  
  // Check the MIME type
  if (file.type.startsWith('image/')) return 'IMAGE';
  if (file.type.startsWith('video/')) return 'VIDEO';
  if (file.type.startsWith('audio/')) return 'AUDIO';
  if (file.type.startsWith('text/') || 
      file.type === 'application/pdf' ||
      file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'TEXT';
  }
  
  // Check file extension as fallback
  const extension = file.name.split('.').pop().toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const videoExts = ['mp4', 'webm', 'avi', 'mov'];
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a'];
  const textExts = ['txt', 'pdf', 'doc', 'docx', 'rtf'];
  
  if (imageExts.includes(extension)) return 'IMAGE';
  if (videoExts.includes(extension)) return 'VIDEO';
  if (audioExts.includes(extension)) return 'AUDIO';
  if (textExts.includes(extension)) return 'TEXT';
  
  return null;
};

const UploadContentForm = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      title: '',
      author: '',
      personalNote: ''
    }
  });

  const onSubmit = async (data) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      const file = data.file[0];
      const mediaType = getMediaType(file);
      console.log('File type:', file.type);
      console.log('Detected media type:', mediaType);
      
      formData.append('file', file);
      formData.append('title', data.title);
      formData.append('author', data.author);
      formData.append('personalNote', data.personalNote);
      formData.append('media_type', mediaType);

      // Log the FormData (for debugging)
      for (let pair of formData.entries()) {
        console.log(pair[0], pair[1]);
      }

      const response = await axiosInstance.post('/content/upload-content/', formData);

      reset();
      setRefreshKey(prev => prev + 1);
      alert('Content uploaded successfully!');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload content. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <div className="upload-form-container">
          <h2>Upload Content</h2>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-group">
              <label>File:</label>
              <input
                type="file"
                {...register('file')}
              />
              {errors.file && <span className="error">{errors.file.message}</span>}
            </div>

            <div className="form-group">
              <label>Title (optional):</label>
              <input
                type="text"
                placeholder="Enter title"
                {...register('title')}
              />
              {errors.title && <span className="error">{errors.title.message}</span>}
            </div>

            <div className="form-group">
              <label>Author (optional):</label>
              <input
                type="text"
                placeholder="Enter author"
                {...register('author')}
              />
              {errors.author && <span className="error">{errors.author.message}</span>}
            </div>

            <div className="form-group">
              <label>Personal Note (optional):</label>
              <textarea
                placeholder="Enter personal note"
                rows={5}
                {...register('personalNote')}
              />
              {errors.personalNote && (
                <span className="error">{errors.personalNote.message}</span>
              )}
            </div>

            <button type="submit" disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Upload Content'}
            </button>
          </form>

          <style>{`
            .upload-form-container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }

            .form-group {
              margin-bottom: 20px;
            }

            label {
              display: block;
              margin-bottom: 5px;
              font-weight: bold;
            }

            input[type="text"],
            textarea {
              width: 100%;
              padding: 8px;
              border: 1px solid #ddd;
              border-radius: 4px;
            }

            textarea {
              resize: vertical;
            }

            .error {
              color: red;
              font-size: 0.8em;
              margin-top: 5px;
              display: block;
            }

            button {
              padding: 10px 20px;
              background-color: #007bff;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            }

            button:disabled {
              background-color: #cccccc;
              cursor: not-allowed;
            }
          `}</style>
        </div>
      </Grid>
      <Grid item xs={12} md={4}>
        <ContentRecentlyUploaded refreshTrigger={refreshKey} />
      </Grid>
    </Grid>
  );
};

export default UploadContentForm; 
