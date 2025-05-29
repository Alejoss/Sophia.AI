import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Grid, TextField, Button, Box, Typography, Paper, Divider, CircularProgress, Link } from '@mui/material';
import UploadContentForm from '../content/UploadContentForm';
import ContentSearchModal from '../content/ContentSearchModal';
import contentApi from '../api/contentApi';
import ContentDisplay from '../content/ContentDisplay';

const PublicationEditForm = () => {
  const navigate = useNavigate();
  const { publicationId } = useParams();
  const [formData, setFormData] = useState({
    text_content: '',
    status: 'PUBLISHED'
  });
  const [selectedContent, setSelectedContent] = useState(null);
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
        console.log('Publication data:', publicationData);
        
        // Set form data
        setFormData({
          text_content: publicationData.text_content || '',
          status: publicationData.status || 'PUBLISHED',
          content_profile_id: publicationData.content_profile_id || null
        });
        
        // Set content if it exists
        if (publicationData.content) {
          console.log('Setting content:', publicationData.content);
          setSelectedContent(publicationData.content);
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
    console.log('Uploaded content:', uploadedContent);
    
    if (uploadedContent && uploadedContent.content) {
      setSelectedContent({
        id: uploadedContent.content.id,
        original_title: uploadedContent.title || uploadedContent.content.original_title,
        media_type: uploadedContent.content.media_type,
        file_details: uploadedContent.content.file_details,
        url: uploadedContent.content.url
      });
      
      setFormData(prev => ({
        ...prev,
        content_profile_id: uploadedContent.id
      }));
    }
    
    setShowUploadForm(false);
    setShowContentOptions(false);
  };

  const handleContentSelect = (selectedContent) => {
    console.log('Selected content:', selectedContent);
    
    // Make sure we have the content_profile_id
    const contentProfileId = selectedContent.profile_id || selectedContent.id;
    
    setSelectedContent({
      id: selectedContent.id,
      original_title: selectedContent.original_title || selectedContent.title,
      media_type: selectedContent.media_type,
      file_details: selectedContent.file_details,
      url: selectedContent.url
    });
    
    setFormData(prev => ({
      ...prev,
      content_profile_id: contentProfileId
    }));
    
    setShowContentModal(false);
    setShowContentOptions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const publicationData = {
        ...formData
      };
      console.log('Sending publication update data:', publicationData);
      await contentApi.updatePublication(publicationId, publicationData);
      navigate('/profiles/my_profile');
    } catch (err) {
      setError('Failed to update publication');
      console.error('Error updating publication:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/profiles/my_profile');
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this publication? This action cannot be undone.')) {
      try {
        setIsLoading(true);
        await contentApi.deletePublication(publicationId);
        navigate('/profiles/my_profile');
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
          onClick={() => navigate('/profiles/my_profile')}
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
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Content:
          </Typography>
          
          {selectedContent ? (
            <>
              <Box sx={{ mb: 2 }}>
                <ContentDisplay 
                  content={selectedContent} 
                  variant="detailed"
                  maxImageHeight={300}
                  showAuthor={true}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button 
                  variant="text" 
                  color="primary" 
                  onClick={() => {
                    setSelectedContent(null);
                    setFormData(prev => ({...prev, content_profile_id: null}));
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
            </>
          ) : (
            <Box sx={{ mb: 2 }}>
              <Button 
                variant="outlined" 
                onClick={() => setShowContentOptions(true)}
              >
                Add Content
              </Button>
            </Box>
          )}
        </Box>
        
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
            Delete
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