import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Box, Typography, Paper, Alert, CircularProgress } from '@mui/material';
import contentApi from '../api/contentApi';
import { MEDIA_BASE_URL } from '../api/config';

const TopicsByUser = ({ userId, userName }) => {
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        // For now, fetch all topics and filter by creator
        // In the future, we might want a specific endpoint for this
        const allTopics = await contentApi.getTopics();
        const userTopics = Array.isArray(allTopics) 
          ? allTopics.filter(topic => 
              topic.creator != null && userId != null && String(topic.creator) === String(userId)
            )
          : [];
        setTopics(userTopics);
      } catch (err) {
        console.error('Error fetching topics by user:', err);
        setError('Error al cargar los temas');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchTopics();
    }
  }, [userId]);

  const getTopicImageUrl = (topic) => {
    if (topic.topic_image) {
      return topic.topic_image.startsWith('http') 
        ? topic.topic_image 
        : `${MEDIA_BASE_URL}${topic.topic_image}`;
    }
    return null;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: { xs: 'wrap', md: 'nowrap' }, gap: 2, mb: 4 }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            fontSize: {
              xs: "1.5rem", // ~24px on mobile
              sm: "1.75rem", // ~28px on small screens
              md: "2.125rem", // ~34px on desktop (default h4)
            },
            fontWeight: 600,
          }}
        >
          Temas por {userName}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, minmax(0, 1fr))',
            xl: 'repeat(3, minmax(0, 1fr))',
          },
        }}
      >
        {topics.map((topic) => {
          const imageUrl = getTopicImageUrl(topic);
          return (
            <Paper
              key={topic.id}
              variant="outlined"
              onClick={() => navigate(`/content/topics/${topic.id}`)}
              sx={{
                p: 3,
                minHeight: 200,
                cursor: 'pointer',
                transition: 'box-shadow 0.2s ease',
                '&:hover': {
                  boxShadow: 3,
                },
              }}
            >
              {/* Image and Title Section */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2, gap: 2 }}>
                <Avatar 
                  src={imageUrl || undefined}
                  alt={topic.title}
                  sx={{ 
                    width: 80, 
                    height: 80, 
                    mr: 3,
                    bgcolor: 'grey.300',
                    flexShrink: 0
                  }}
                >
                  {topic.title.charAt(0).toUpperCase()}
                </Avatar>
                
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* Title Section */}
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      mb: 1,
                      cursor: 'pointer',
                      '&:hover': { color: 'primary.main' }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/content/topics/${topic.id}`);
                    }}
                  >
                    {topic.title}
                  </Typography>

                  {/* Description */}
                  {topic.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {topic.description}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Date */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  {topic.created_at
                    ? new Date(topic.created_at).toLocaleDateString()
                    : ''}
                </Typography>
              </Box>
            </Paper>
          );
        })}
      </Box>

      {/* No Topics Message */}
      {topics.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography
            variant="h6"
            sx={{
              fontSize: "1.25rem",
              fontWeight: 600,
              color: 'text.secondary',
              mb: 2
            }}
          >
            Aún no se han creado temas
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {userName} aún no ha creado temas.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default TopicsByUser;