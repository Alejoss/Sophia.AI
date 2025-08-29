import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, IconButton, FormControlLabel, Switch, Typography } from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { isAuthenticated } from '../context/localStorageUtils';
import knowledgePathsApi from '../api/knowledgePathsApi';

const KnowledgePathCreationForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      // Prepare form data with image if selected
      const submitData = { ...formData };
      if (selectedImage) {
        submitData.image = selectedImage;
      }
      
      const data = await knowledgePathsApi.createKnowledgePath(submitData);
      navigate(`/knowledge_path/${data.id}/edit`);
    } catch (err) {
      setError(err.message || 'Failed to create knowledge path');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="md:!text-3xl !text-2xl font-bold mb-6 text-gray-900">Create Knowledge Path</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6">
          {/* Image Upload Section */}
          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-3">
              Cover Image (Optional)
            </label>
            <div className="flex items-center space-x-4">
              <Avatar 
                src={imagePreview} 
                alt="Knowledge Path Cover"
                sx={{ 
                  width: 100, 
                  height: 100, 
                  bgcolor: 'grey.300',
                  fontSize: '2rem'
                }}
              >
                {formData.title ? formData.title.charAt(0).toUpperCase() : 'K'}
              </Avatar>
              <div>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="image-upload"
                  type="file"
                  onChange={handleImageUpload}
                />
                <label htmlFor="image-upload">
                  <IconButton
                    color="primary"
                    aria-label="upload picture"
                    component="span"
                    sx={{ 
                      border: '2px dashed #ccc',
                      borderRadius: '8px',
                      padding: '12px'
                    }}
                  >
                    <PhotoCameraIcon />
                  </IconButton>
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  Click to upload a cover image
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="title" className="block text-gray-700 font-bold mb-2">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="Enter knowledge path title"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="description" className="block text-gray-700 font-bold mb-2">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows="4"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="Describe your knowledge path"
            />
          </div>

          <div className="flex md:flex-nowrap flex-wrap gap-4">
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline transition-colors"
            >
              Create Knowledge Path
            </button>
            <button
              type="button"
              onClick={() => navigate('/knowledge_paths')}
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default KnowledgePathCreationForm; 