import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Button, Grid, CircularProgress, Divider, IconButton } from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import contentApi from '../api/contentApi';
import ContentDisplay from '../content/ContentDisplay';
import BookmarkButton from '../bookmarks/BookmarkButton';
import VoteComponent from '../votes/VoteComponent';

// ContentDisplay Mode: "preview" - Basic preview for publication list items
const PublicationList = ({ isOwnProfile = false, userId = null }) => {
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

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
        setError('Error al cargar las publicaciones');
      } finally {
        setLoading(false);
      }
    };

    fetchPublications();
  }, [isOwnProfile, userId]);

  const handleLinkClick = (publicationId, event) => {
    event.stopPropagation();
    navigate(`/publications/${publicationId}`);
  };

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
          No se encontraron publicaciones.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={3}>
        {publications.map((publication) => {
          const hasContent = publication.content;
          
          return (
            <Grid item xs={12} key={publication.id}>
              <Paper 
                elevation={2} 
                sx={{ 
                  p: 3,
                  transition: 'all 0.2s ease-in-out',
                  position: 'relative',
                  '&:hover': {
                    elevation: 4,
                    transform: 'translateY(-2px)',
                    boxShadow: 3
                  }
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Publicado: {new Date(publication.published_at).toLocaleDateString('es-ES')}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <BookmarkButton 
                      contentId={publication.id}
                      contentType="publication"
                    />
                    {isOwnProfile && (
                      <Button 
                        component={Link} 
                        to={`/publications/${publication.id}/edit`} 
                        variant="outlined" 
                        color="primary"
                        size="small"
                      >
                        Editar
                      </Button>
                    )}
                  </Box>
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                {hasContent && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Contenido Referenciado:
                    </Typography>
                    
                    <ContentDisplay 
                      content={publication.content}
                      variant="preview"
                      maxImageHeight={200}
                      showAuthor={true}
                    />
                  </Box>
                )}
                
                <Typography variant="body1">
                  {publication.text_content}
                </Typography>

                {/* Voting Section */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                  <VoteComponent
                    type="publication"
                    ids={{ publicationId: publication.id }}
                    initialVoteCount={publication.vote_count || 0}
                    initialUserVote={publication.user_vote || 0}
                  />
                  
                  {/* Link icon in bottom right corner */}
                  <IconButton
                    onClick={(event) => handleLinkClick(publication.id, event)}
                    sx={{
                      backgroundColor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': {
                        backgroundColor: 'primary.light',
                        color: 'primary.contrastText'
                      }
                    }}
                    size="small"
                  >
                    <LinkIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default PublicationList; 