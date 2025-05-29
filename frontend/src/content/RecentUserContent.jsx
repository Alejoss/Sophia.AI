import React, { useState, useEffect } from 'react';
import { Grid, Typography, Box, CircularProgress } from '@mui/material';
import contentApi from '../api/contentApi';
import ContentDisplay from './ContentDisplay';

const RecentUserContent = () => {
  const [recentContent, setRecentContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRecentContent = async () => {
      try {
        const data = await contentApi.getRecentContent();
        setRecentContent(data);
        setLoading(false);
      } catch (err) {
        setError('Failed to load recent content');
        setLoading(false);
        console.error('Error fetching recent content:', err);
      }
    };

    fetchRecentContent();
  }, []);

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
        {recentContent.map((profile) => (
          <Grid item xs={12} key={profile.id}>
            <ContentDisplay
              content={{
                ...profile.content,
                selected_profile: {
                  title: profile.title,
                  author: profile.author,
                  personal_note: profile.personal_note,
                  is_visible: profile.is_visible,
                  is_producer: profile.is_producer
                }
              }}
              variant="simple"
              showAuthor={true}
              maxImageHeight={150}
            />
          </Grid>
        ))}
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