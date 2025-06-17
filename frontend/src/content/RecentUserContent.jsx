import React, { useState, useEffect } from 'react';
import { Grid, Typography, Box, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import contentApi from '../api/contentApi';
import ContentDisplay from './ContentDisplay';

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
        setError('Failed to load recent content');
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
        Recently Uploaded Content
      </Typography>
      <Grid container spacing={2}>
        {recentContent.map((profile) => {
          const contentData = {
            ...profile.content,
            url: profile.content.url || profile.content.file_url,
            selected_profile: {
              id: profile.id,
              title: profile.title,
              author: profile.author
            }
          };
          
          return (
            <Grid item xs={12} key={profile.id}>
              <ContentDisplay
                content={contentData}
                variant="simple"
                showAuthor={true}
                maxImageHeight={150}
                onClick={() => handleContentClick(contentData.id)}
              />
            </Grid>
          );
        })}
        {recentContent.length === 0 && (
          <Grid item xs={12}>
            <Typography color="text.secondary" align="center">
              No recent content found
            </Typography>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default RecentUserContent; 