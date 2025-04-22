import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, Paper, Button, Grid, CircularProgress, Divider, Card, CardMedia, CardContent } from '@mui/material';
import contentApi from '../api/contentApi';
import { getFileUrl } from '../utils/fileUtils';

const PublicationList = ({ isOwnProfile = false }) => {
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPublications = async () => {
      try {
        setLoading(true);
        const data = await contentApi.getUserPublications();
        setPublications(data);
        setError(null);
      } catch (err) {
        setError('Failed to load publications');
      } finally {
        setLoading(false);
      }
    };

    fetchPublications();
  }, []);

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
          const hasContentFile = publication.content_profile && 
                                publication.content_profile.content && 
                                publication.content_profile.content.file_details && 
                                publication.content_profile.content.file_details.file;
          
          const rawFileUrl = hasContentFile ? publication.content_profile.content.file_details.file : null;
          const fileUrl = getFileUrl(rawFileUrl);
          const mediaType = publication.content_profile?.content?.media_type || '';
          const isImage = mediaType === 'IMAGE';
          
          const contentId = publication.content_profile?.content?.id;
          
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
                
                {hasContentFile && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Referenced Content:
                    </Typography>
                    
                    {isImage ? (
                      <Card sx={{ maxWidth: 400, mb: 2 }}>
                        <CardMedia
                          component="img"
                          height="200"
                          image={fileUrl}
                          alt={publication.content_profile.display_title || "Content image"}
                          onError={(e) => {
                            e.target.src = '/placeholder-image.png';
                            e.target.onerror = null;
                          }}
                        />
                        <CardContent>
                          <Typography variant="body2" color="text.secondary">
                            {publication.content_profile.display_title || "Untitled"}
                          </Typography>
                          {contentId && (
                            <Button 
                              component={Link}
                              to={`/content/${contentId}/library`}
                              variant="outlined"
                              size="small"
                              sx={{ mt: 1 }}
                            >
                              View Content Details
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body1">
                          {publication.content_profile.display_title || "Untitled"}
                        </Typography>
                        {contentId && (
                          <Button 
                            component={Link}
                            to={`/content/${contentId}/library`}
                            variant="outlined"
                            size="small"
                            sx={{ mt: 1 }}
                          >
                            View Content Details
                          </Button>
                        )}
                      </Box>
                    )}
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