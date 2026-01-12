import React, { useState, useEffect } from 'react';
import { Grid, Typography, Box, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import contentApi from '../api/contentApi';
import ContentDisplay from './ContentDisplay';

// ContentDisplay Mode: "simple" - Uses SimpleContentProfileSerializer for optimized performance
const RecentUserContent = () => {
  const [recentContent, setRecentContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRecentContent = async () => {
      try {
        console.log('\n=== Fetching Recent Content ===');
        const data = await contentApi.getRecentContent();
        console.log('Recent content data:', JSON.stringify(data, null, 2));
        setRecentContent(data);
        setLoading(false);
      } catch (err) {
        console.error('\nError fetching recent content:', err);
        setError('Error al cargar el contenido reciente');
        setLoading(false);
      }
    };

    fetchRecentContent();
  }, []);

  const handleContentClick = (contentId) => {
    navigate(`/content/${contentId}/library?context=library`);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color="error" align="center">
        {error}
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Contenido subido recientemente
      </Typography>
      <Grid container spacing={2}>
        {recentContent.map((profile) => {
          return (
            <Grid item xs={12} key={profile.id}>
              <ContentDisplay
                content={profile.content}
                variant="simple"
                showAuthor={false}
                maxImageHeight={150}
                onClick={() => handleContentClick(profile.content.id)}
              />
            </Grid>
          );
        })}
        {recentContent.length === 0 && (
          <Grid item xs={12}>
            <Typography color="text.secondary" align="center">
              No se encontró contenido reciente
            </Typography>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default RecentUserContent; 