import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Chip,
  Button,
  Link } from
'@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';
import { resolveMediaUrl } from '../utils/fileUtils';
import CommentSection from '../comments/CommentSection';
import VoteComponent from '../votes/VoteComponent';
import TopicHeader from './TopicHeader';
import ContentDisplay from '../content/ContentDisplay';

const TopicContentMediaType = () => {
  const { topicId, mediaType } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('topics');
  const [topic, setTopic] = useState(null);
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTopicAndContents = async () => {
      try {

        const [topicData, contentsData] = await Promise.all([
        contentApi.getTopicDetails(topicId),
        contentApi.getTopicContentByType(topicId, mediaType)]
        );


        setTopic(topicData);
        setContents(contentsData.contents || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        console.error('Error details:', {
          message: err.message,
          status: err.response?.status,
          data: err.response?.data
        });
        setError(t('media.loadError'));
        setLoading(false);
      }
    };

    fetchTopicAndContents();
  }, [topicId, mediaType, t]);

  const renderContentPreview = (content) => {
    if (!content.file_details) return null;

    switch (mediaType) {
      case 'image':
        return (
          <CardMedia
            component="img"
            sx={{
              height: 200,
              width: '100%',
              objectFit: 'cover'
            }}
            image={resolveMediaUrl(content.file_details?.url) || `https://picsum.photos/800/600?random=${content.id}`}
            alt={content.selected_profile?.title || t('media.imageAlt')} />);


      case 'text':
        return (
          <CardContent>
                        <Typography variant="body2" color="text.secondary" noWrap>
                            {content.file_details?.text || t('media.previewUnavailable')}
                        </Typography>
                    </CardContent>);

      case 'video':
        return (
          <Box sx={{ position: 'relative', height: 200 }}>
                        <CardMedia
              component="video"
              sx={{
                height: '100%',
                width: '100%',
                objectFit: 'cover'
              }}
              image={resolveMediaUrl(content.file_details?.url)} />
            
                        <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(0, 0, 0, 0.3)'
              }}>
              
                            <Typography variant="body1" color="white">
                                {t('media.clickToPlay')}
                            </Typography>
                        </Box>
                    </Box>);

      case 'audio':
        return (
          <Box sx={{ p: 2 }}>
                        <audio
              controls
              style={{ width: '100%' }}>
              
                            <source src={resolveMediaUrl(content.file_details?.url)} type="audio/mpeg" />
                            {t('media.audioUnsupported')}
                        </audio>
                    </Box>);

      default:
        return null;
    }
  };

  if (loading) return <Typography>{t('media.loading')}</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;
  if (!topic) return <Typography>{t('media.notFound')}</Typography>;

  return (
    <Box sx={{ pt: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
            <TopicHeader
        topic={topic}
        onEdit={() => navigate(`/content/topics/${topicId}/edit`)}
        size="small" />
      

            <Box sx={{ mb: 4 }}>
                <Button
          onClick={() => navigate(`/content/topics/${topicId}`)}
          startIcon={<ArrowBackIcon />}
          sx={{ mb: 2, textTransform: 'none' }}>
          
                    {t('media.backToTopic')}
                </Button>
                <Typography
          variant="h5"
          sx={{
            mb: 2,
            fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
            fontWeight: 400,
            fontSize: "20px"
          }}
          color="text.primary">
          
                    {mediaType === 'image' ? t('media.allImages') : mediaType === 'text' ? t('media.allTexts') : t('media.allOfType', { type: `${mediaType}s` })}
                </Typography>

                <Grid container spacing={3}>
                    {contents.map((content) =>
          <Grid item xs={12} sm={6} md={4} key={content.id}>
                            <ContentDisplay
              content={content}
              variant="card"
              showAuthor={true}
              showTitle={mediaType !== 'image'}
              topicId={topicId}
              onClick={() => navigate(`/content/${content.id}/topic/${topicId}`)} />
            
                        </Grid>
          )}
                </Grid>
            </Box>

            <CommentSection topicId={topicId} />
        </Box>);

};

export default TopicContentMediaType;