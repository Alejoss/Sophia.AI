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
    Link
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import contentApi from '../api/contentApi';
import { MEDIA_BASE_URL } from '../api/config';
import CommentSection from '../comments/CommentSection';
import VoteComponent from '../votes/VoteComponent';
import TopicHeader from './TopicHeader';

const TopicContentMediaType = () => {
    const { topicId, mediaType } = useParams();
    const navigate = useNavigate();
    const [topic, setTopic] = useState(null);
    const [contents, setContents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchTopicAndContents = async () => {
            try {
                console.log(`Fetching topic ${topicId} and ${mediaType} contents...`);
                const [topicData, contentsData] = await Promise.all([
                    contentApi.getTopicDetails(topicId),
                    contentApi.getTopicContentByType(topicId, mediaType)
                ]);
                
                console.log('Received topic data:', topicData);
                console.log('Received contents data:', contentsData);
                
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
                setError('Failed to fetch topic or content details');
                setLoading(false);
            }
        };

        fetchTopicAndContents();
    }, [topicId, mediaType]);

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
                        image={content.file_details?.url || `https://picsum.photos/800/600?random=${content.id}`}
                        alt={content.selected_profile?.title || 'Content image'}
                    />
                );
            case 'text':
                return (
                    <CardContent>
                        <Typography variant="body2" color="text.secondary" noWrap>
                            {content.file_details?.text || 'No preview available'}
                        </Typography>
                    </CardContent>
                );
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
                            image={content.file_details?.url}
                        />
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
                                bgcolor: 'rgba(0, 0, 0, 0.3)',
                            }}
                        >
                            <Typography variant="body1" color="white">
                                Click to play video
                            </Typography>
                        </Box>
                    </Box>
                );
            case 'audio':
                return (
                    <Box sx={{ p: 2 }}>
                        <audio
                            controls
                            style={{ width: '100%' }}
                        >
                            <source src={content.file_details?.url} type="audio/mpeg" />
                            Your browser does not support the audio element.
                        </audio>
                    </Box>
                );
            default:
                return null;
        }
    };

    if (loading) return <Typography>Loading content...</Typography>;
    if (error) return <Typography color="error">{error}</Typography>;
    if (!topic) return <Typography>Topic not found</Typography>;

    return (
        <Box sx={{ pt: 12, px: 3, maxWidth: 1200, mx: 'auto' }}>
            <TopicHeader 
                topic={topic}
                onEdit={() => navigate(`/content/topics/${topicId}/edit`)}
            />

            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <IconButton 
                        onClick={() => navigate(`/content/topics/${topicId}`)}
                        sx={{ mr: 2 }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h5" sx={{ textTransform: 'capitalize' }}>
                        All {mediaType}s
                    </Typography>
                </Box>

                <Grid container spacing={3}>
                    {contents.map((content) => (
                        <Grid item xs={12} sm={6} md={4} key={content.id}>
                            <Card 
                                sx={{ 
                                    height: '100%', 
                                    display: 'flex',
                                    flexDirection: 'column',
                                    cursor: 'pointer'
                                }}
                                onClick={() => navigate(`/content/${content.id}/topic/${topicId}`)}
                            >
                                {renderContentPreview(content)}
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Typography variant="h6" gutterBottom>
                                        {content.selected_profile?.title || content.original_title || 'Untitled'}
                                    </Typography>
                                    {content.selected_profile?.author && (
                                        <Chip 
                                            label={`Author: ${content.selected_profile.author}`}
                                            size="small"
                                            variant="outlined"
                                            sx={{ mt: 1 }}
                                        />
                                    )}
                                    <Box 
                                        sx={{ mt: 2 }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <VoteComponent
                                            type="content"
                                            ids={{
                                                topicId: topicId,
                                                contentId: content.id
                                            }}
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

            <CommentSection topicId={topicId} />
        </Box>
    );
};

export default TopicContentMediaType; 