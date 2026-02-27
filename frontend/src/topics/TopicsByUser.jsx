import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Box, Typography } from '@mui/material';
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
      <div className="text-center py-8">Cargando...</div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center py-8">{error}</div>
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
        {topics.map((topic) => {
          const imageUrl = getTopicImageUrl(topic);
          return (
            <div 
              key={topic.id}
              className="block p-6 bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow min-h-[200px] cursor-pointer"
              onClick={() => navigate(`/content/topics/${topic.id}`)}
            >
              {/* Image and Title Section */}
              <div className="flex items-start mb-4">
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
                
                <div className="flex-1 min-w-0">
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
                    <p className="text-gray-600 mb-3 line-clamp-3">{topic.description}</p>
                  )}
                </div>
              </div>

              {/* Date */}
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>{topic.created_at ? new Date(topic.created_at).toLocaleDateString() : ''}</span>
              </div>
            </div>
          );
        })}
      </div>

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