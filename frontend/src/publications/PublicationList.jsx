import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, Paper, Button, Grid, CircularProgress, Divider } from '@mui/material';
import contentApi from '../api/contentApi';
import { createContentDetailUrl, CONTEXT_TYPES } from '../utils/urlUtils';
import ContentDisplay from '../content/ContentDisplay';

const PublicationList = ({ isOwnProfile = false, userId = null }) => {
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPublications = async () => {
      try {
        setLoading(true);
        let data;
        if (isOwnProfile || !userId) {
          data = await contentApi.getUserPublications();
        } else {
          data = await contentApi.getUserPublicationsById(userId);
        }
        setPublications(data);
        setError(null);
      } catch (err) {
        setError('Failed to load publications');
      } finally {
        setLoading(false);
      }
    };

    fetchPublications();
  }, [isOwnProfile, userId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (publications.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          No publications found.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={3}>
        {publications.map((publication) => {
          const hasContent = publication.content;
          const contentId = publication.content?.id;
          
          return (
            <Grid item xs={12} key={publication.id}>
              <Paper elevation={2} sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Published: {new Date(publication.published_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                  
                  {isOwnProfile && (
                    <Button 
                      component={Link} 
                      to={`/publications/${publication.id}/edit`} 
                      variant="outlined" 
                      color="primary"
                      size="small"
                    >
                      Edit
                    </Button>
                  )}
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                {hasContent && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Referenced Content:
                    </Typography>
                    
                    <Box sx={{ mb: 2 }}>
                      <ContentDisplay 
                        content={publication.content}
                        variant="detailed"
                        maxImageHeight={200}
                        showAuthor={true}
                        additionalActions={
                          contentId && (
                            <Button 
                              component={Link}
                              to={createContentDetailUrl(contentId, CONTEXT_TYPES.PUBLICATION, publication.id)}
                              variant="outlined"
                              size="small"
                              sx={{ mt: 1 }}
                            >
                              View Content Details
                            </Button>
                          )
                        }
                      />
                    </Box>
                  </Box>
                )}
                
                <Typography variant="body1">
                  {publication.text_content}
                </Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default PublicationList; 