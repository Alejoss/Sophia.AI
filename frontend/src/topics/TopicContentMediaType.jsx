import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    Grid, 
    Card, 
    CardContent, 
    CardMedia, 
    Chip, 
    IconButton,
    Breadcrumbs,
    Link
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import contentApi from '../api/contentApi';
import VoteComponent from '../votes/VoteComponent';

const TopicContentMediaType = () => {
    const { topicId, mediaType } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const response = await contentApi.getTopicContentByType(topicId, mediaType);
                setData(response);
                setLoading(false);
            } catch (err) {
                setError('Failed to fetch content');
                setLoading(false);
            }
        };

        fetchContent();
    }, [topicId, mediaType]);

    if (loading) return <Typography>Loading content...</Typography>;
    if (error) return <Typography color="error">{error}</Typography>;
    if (!data) return <Typography>No content found</Typography>;

    return (
        <Box sx={{ pt: 12, px: 3, maxWidth: 1200, mx: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <IconButton 
                    onClick={() => navigate(`/content/topics/${topicId}`)}
                    sx={{ mr: 2 }}
                >
                    <ArrowBackIcon />
                </IconButton>
                <Box>
                    <Breadcrumbs>
                        <Link
                            component="button"
                            variant="body1"
                            onClick={() => navigate(`/content/topics/${topicId}`)}
                        >
                            {data.topic.title}
                        </Link>
                        <Typography variant="body1" color="text.primary" sx={{ textTransform: 'capitalize' }}>
                            {mediaType}s
                        </Typography>
                    </Breadcrumbs>
                    <Typography variant="h4" sx={{ mt: 1, textTransform: 'capitalize' }}>
                        {mediaType} Content
                    </Typography>
                </Box>
            </Box>

            <Grid container spacing={3}>
                {data.contents.map((content) => (
                    <Grid item xs={12} sm={6} md={4} key={content.id}>
                        <Card 
                            sx={{ height: '100%', cursor: 'pointer' }}
                            onClick={() => navigate(`/content/${content.id}/topic/${topicId}`)}
                        >
                            {mediaType === 'image' && (
                                <CardMedia
                                    component="img"
                                    height="140"
                                    image={content.file_details?.file ? `http://localhost:8000${content.file_details.file}` : `https://picsum.photos/800/600?random=${content.id}`}
                                    alt={content.selected_profile?.title || 'Untitled'}
                                    sx={{ objectFit: 'cover' }}
                                />
                            )}
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    {content.selected_profile?.title || content.original_title || 'Untitled'}
                                </Typography>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    {content.selected_profile?.author && (
                                        <Chip 
                                            label={`Author: ${content.selected_profile.author}`}
                                            size="small"
                                            variant="outlined"
                                        />
                                    )}
                                    <VoteComponent 
                                        type="content"
                                        ids={{ topicId: topicId, contentId: content.id }}
                                        initialVoteCount={content.vote_count || 0}
                                        initialUserVote={content.user_vote || 0}
                                    />
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};

export default TopicContentMediaType; 