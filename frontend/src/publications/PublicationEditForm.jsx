import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Grid, TextField, Button, Box, Typography, Paper, Divider, CircularProgress, Link } from '@mui/material';
import UploadContentForm from '../content/UploadContentForm';
import ContentSearchModal from '../content/ContentSearchModal';
import contentApi from '../api/contentApi';
import { getFileUrl } from '../utils/fileUtils';

const PublicationEditForm = () => {
  const navigate = useNavigate();
  const { publicationId } = useParams();
  const [formData, setFormData] = useState({
    text_content: '',
    status: 'PUBLISHED'
  });
  const [content, setContent] = useState(null);
  const [error, setError] = useState(null);
  const [showContentOptions, setShowContentOptions] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const fetchPublicationDetails = async () => {
      try {
        setIsFetching(true);
        const publicationData = await contentApi.getPublicationDetails(publicationId);
        
        // Set form data
        setFormData({
          text_content: publicationData.text_content || '',
          status: publicationData.status || 'PUBLISHED'
        });
        
        // Set content if it exists
        if (publicationData.content_profile) {
          setContent(publicationData.content_profile);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching publication details:', err);
        setError('Failed to load publication details');
      } finally {
        setIsFetching(false);
      }
    };

    fetchPublicationDetails();
  }, [publicationId]);

  const handleContentUpload = (uploadedContent) => {
    setContent(uploadedContent);
    setShowUploadForm(false);
    setShowContentOptions(false);
  };

  const handleContentSelect = (selectedContent) => {
    setContent(selectedContent);
    setShowContentModal(false);
    setShowContentOptions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const publicationData = {
        ...formData,
        content_profile_id: content?.id || null
      };
      console.log('Sending publication update data:', publicationData);
      await contentApi.updatePublication(publicationId, publicationData);
      navigate('/profiles/profile');
    } catch (err) {
      setError('Failed to update publication');
      console.error('Error updating publication:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/profiles/profile');
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this publication? This action cannot be undone.')) {
      try {
        setIsLoading(true);
        await contentApi.deletePublication(publicationId);
        navigate('/profiles/profile');
      } catch (err) {
        setError('Failed to delete publication');
        console.error('Error deleting publication:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (isFetching) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Link 
          component="button"
          variant="body2"
          onClick={() => navigate('/profiles/profile')}
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          ← Back to Profile
        </Link>
      </Box>

      <Typography variant="h4" gutterBottom>
        Edit Publication
      </Typography>
      
      {showContentOptions && (
        <Paper elevation={2} sx={{ p: 4, mb: 4 }}>
          <Typography variant="h6" gutterBottom align="center">
            Choose Content Source (Optional)
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
            <Button 
              variant="contained" 
              color="primary" 
              size="large"
              onClick={() => setShowContentModal(true)}
            >
              Choose Content from Library
            </Button>
            <Button 
              variant="contained" 
              color="secondary" 
              size="large"
              onClick={() => setShowUploadForm(true)}
            >
              Upload New Content
            </Button>
          </Box>
        </Paper>
      )}

      {showUploadForm && (
        <Box sx={{ mb: 4 }}>
          <Button 
            variant="outlined" 
            onClick={() => setShowUploadForm(false)}
            sx={{ mb: 2 }}
          >
            ← Back
          </Button>
          <UploadContentForm onContentUploaded={handleContentUpload} />
        </Box>
      )}

      <Paper elevation={2} sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Publication Details
        </Typography>
        
        {content && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Selected Content:
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="body1">
                {content.display_title || content.original_title || 'Untitled'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Type: {content.content?.media_type || 'Unknown'}
              </Typography>
              
              {content.content?.media_type === 'IMAGE' && content.content?.file_details?.file && (
                <Box sx={{ mt: 2, maxWidth: 300 }}>
                  <img 
                    src={getFileUrl(content.content.file_details.file)} 
                    alt={content.display_title || 'Content image'}
                    style={{ width: '100%', height: 'auto', borderRadius: '4px' }}
                    onError={(e) => {
                      console.error('Image failed to load:', content.content.file_details.file);
                      e.target.src = '/placeholder-image.png';
                      e.target.onerror = null;
                    }}
                  />
                </Box>
              )}
            </Paper>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button 
                variant="text" 
                color="primary" 
                onClick={() => {
                  setContent(null);
                  setShowContentOptions(true);
                }}
              >
                Remove Content
              </Button>
              <Button 
                variant="text" 
                color="primary" 
                onClick={() => setShowContentOptions(true)}
              >
                Change Content
              </Button>
            </Box>
          </Box>
        )}
        
        {!content && (
          <Box sx={{ mb: 3 }}>
            <Button 
              variant="outlined" 
              onClick={() => setShowContentOptions(true)}
              sx={{ mb: 2 }}
            >
              Add Content
            </Button>
          </Box>
        )}
        
        <TextField
          fullWidth
          multiline
          rows={4}
          label="Text Content"
          value={formData.text_content}
          onChange={(e) => setFormData({ ...formData, text_content: e.target.value })}
          required
          sx={{ mb: 3 }}
        />

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            color="error"
            onClick={handleDelete}
            disabled={isLoading}
          >
            Delete Publication
          </Button>
          <Button
            variant="outlined"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? 'Updating...' : 'Update Publication'}
          </Button>
        </Box>
      </Paper>

      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}

      <ContentSearchModal 
        isOpen={showContentModal} 
        onClose={() => setShowContentModal(false)} 
        onSelectContent={handleContentSelect}
        isLoading={isLoading}
      />
    </Box>
  );
};

export default PublicationEditForm; 