import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';

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

const UploadContentForm = () => {
  const [isUploading, setIsUploading] = useState(false);
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
      formData.append('file', data.file[0]);
      formData.append('title', data.title);
      formData.append('author', data.author);
      formData.append('personalNote', data.personalNote);

      const response = await fetch('/api/upload-content', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
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

      <style jsx>{`
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
  );
};

export default UploadContentForm; 
