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
          ? allTopics.filter(topic => topic.creator === userId)
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
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center md:flex-nowrap flex-wrap md:gap-0 gap-4 mb-6">
        <h1 className="md:!text-2xl !text-xl font-bold !text-gray-900">
          Temas por {userName}
        </h1>
      </div>

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
        <div className="text-center py-12">
          <h3 className="text-xl font-semibold text-gray-600 mb-4">Aún no se han creado temas</h3>
          <p className="text-gray-500 mb-6">
            {userName} aún no ha creado temas.
          </p>
        </div>
      )}
    </div>
  );
};

export default TopicsByUser;