import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import axiosInstance from '../api/axiosConfig';
import { Grid, FormControlLabel, Switch, Checkbox, Typography, Paper } from '@mui/material';

const schema = yup.object().shape({
  // TODO, only the image files have author and title as optional fields
  file: yup
    .mixed()
    .required('File is required'),

  title: yup.string().max(100, 'Title must not exceed 100 characters'),
  author: yup.string().max(100, 'Author must not exceed 100 characters'),
  is_producer: yup.boolean().default(false),  // Default to false
  is_visible: yup.boolean().default(true),
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

const UploadContentForm = ({ onContentUploaded }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isProducer, setIsProducer] = useState(false); // Default to false
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      title: '',
      author: '',
      is_producer: false,  // Default to false
      is_visible: true
    }
  });

  const onSubmit = async (data) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      const file = data.file[0];
      const mediaType = getMediaType(file);
      
      formData.append('file', file);
      formData.append('title', data.title);
      formData.append('author', data.author);
      formData.append('media_type', mediaType);
      formData.append('is_producer', data.is_producer === true);  // Ensure boolean
      formData.append('is_visible', data.is_visible === true);    // Ensure boolean

      const response = await axiosInstance.post('/content/upload-content/', formData);
      
      if (onContentUploaded) {
        onContentUploaded(response.data.content_profile);
      }

      reset();
      alert('Content uploaded successfully!');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload content. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
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
            <FormControlLabel
              control={
                <Checkbox
                  checked={watch('is_producer')}
                  onChange={(e) => {
                    setValue('is_producer', e.target.checked);
                    setIsProducer(e.target.checked);
                  }}
                  {...register('is_producer')}
                />
              }
              label="I've produced this content"
            />
          </div>

          {watch('is_producer') && (
            <div className="form-group">
              <FormControlLabel
                control={
                  <Switch
                    checked={watch('is_visible')}
                    onChange={(e) => setValue('is_visible', e.target.checked)}
                    {...register('is_visible')}
                  />
                }
                label="Visible in search results"
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, ml: 4 }}>
                Note: Only the producer of the content can make it invisible in search results.
              </Typography>
            </div>
          )}

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
    </Paper>
  );
};

export default UploadContentForm; 
