import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    Paper, 
    Button,
    Divider,
    Grid,
    Card,
    CardContent,
    CardMedia,
    Chip,
    IconButton,
    Link
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import NoteIcon from '@mui/icons-material/Note';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import contentApi from '../api/contentApi';
import { isAuthenticated, getUserFromLocalStorage } from '../context/localStorageUtils';
import { MEDIA_BASE_URL } from '../api/config';
import CommentSection from '../comments/CommentSection';

const TopicDetail = () => {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const [topic, setTopic] = useState(null);
    const [contentByType, setContentByType] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchTopic = async () => {
            try {
                console.log(`Fetching topic ${topicId}...`);
                const data = await contentApi.getTopicDetails(topicId);
                console.log('Received topic data:', data);
                setTopic(data);
                
                // Check if contents exists before processing
                if (!data.contents) {
                    console.log('No contents in topic data');
                    setContentByType({});
                    setLoading(false);
                    return;
                }
                
                // Group content by media type
                const grouped = data.contents.reduce((acc, content) => {
                    const type = content.media_type.toLowerCase();
                    console.log(`Processing content of type: ${type}`, content);
                    if (!acc[type]) {
                        acc[type] = [];
                    }
                    acc[type].push(content);
                    return acc;
                }, {});

                // Sort each group by created_at
                Object.keys(grouped).forEach(type => {
                    grouped[type].sort((a, b) => 
                        new Date(b.created_at) - new Date(a.created_at)
                    );
                });

                console.log('Grouped content by type:', grouped);
                setContentByType(grouped);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching topic:', err);
                console.error('Error details:', {
                    message: err.message,
                    status: err.response?.status,
                    data: err.response?.data
                });
                setError('Failed to fetch topic details');
                setLoading(false);
            }
        };

        fetchTopic();
    }, [topicId]);

    const renderContentPreview = (content, type) => {
        if (!content.file_details) return null;

        switch (type) {
            case 'image':
                return (
                    <CardMedia
                        component="img"
                        sx={{ 
                            height: 200,
                            width: '100%',
                            objectFit: 'cover'
                        }}
                        image={content.file_details.url}
                        alt={content.selected_profile?.title || 'Content image'}
                    />
                );
            case 'text':
                return (
                    <CardContent>
                        <Typography variant="body2" color="text.secondary" noWrap>
                            {content.file_details.text || 'No preview available'}
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
                            image={content.file_details.url}
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
                            <source src={content.file_details.url} type="audio/mpeg" />
                            Your browser does not support the audio element.
                        </audio>
                    </Box>
                );
            default:
                return null;
        }
    };

    const renderContentSection = (type, contents) => {
        if (!contents || contents.length === 0) return null;

        const displayContents = contents.slice(0, 3);
        const hasMore = contents.length > 3;

        return (
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                        {type}s
                    </Typography>
                    {hasMore && (
                        <Button
                            endIcon={<ArrowForwardIcon />}
                            onClick={() => navigate(`/content/topics/${topicId}/${type}`)}
                            sx={{ textTransform: 'none' }}
                        >
                            See all {contents.length} {type}s
                        </Button>
                    )}
                </Box>

                <Grid container spacing={3}>
                    {displayContents.map((content) => (
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
                                {renderContentPreview(content, type)}
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
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Box>
        );
    };

    if (loading) return <Typography>Loading topic details...</Typography>;
    if (error) return <Typography color="error">{error}</Typography>;
    if (!topic) return <Typography>Topic not found</Typography>;

    const user = getUserFromLocalStorage();

    console.log('Auth check:', {
        isAuthenticated: isAuthenticated(),
        topicCreator: topic.creator,
        localStorageUser: user,
        condition: isAuthenticated() && topic.creator === user?.id
    });

    return (
        <Box sx={{ pt: 12, px: 3, maxWidth: 1200, mx: 'auto' }}>
            <Paper sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, mb: 3 }}>
                    {/* Topic Image */}
                    <Box sx={{ width: 200, height: 200 }}>
                        <img
                            src={topic.topic_image || '/default-topic-image.png'}
                            alt={topic.title}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                borderRadius: '4px'
                            }}
                        />
                    </Box>

                    {/* Topic Info */}
                    <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Typography variant="h4" gutterBottom>
                                {topic.title}
                            </Typography>
                            {isAuthenticated() && topic.creator === user?.id && (
                                <Button
                                    variant="outlined"
                                    startIcon={<EditIcon />}
                                    onClick={() => navigate(`/content/topics/${topicId}/edit`)}
                                >
                                    Edit Topic
                                </Button>
                            )}
                        </Box>
                        {topic.description && (
                            <Typography variant="body1" sx={{ mt: 2 }}>
                                {topic.description}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Paper>

            {/* Content sections by type */}
            {renderContentSection('image', contentByType.image)}
            {renderContentSection('text', contentByType.text)}
            {renderContentSection('video', contentByType.video)}
            {renderContentSection('audio', contentByType.audio)}

            {Object.keys(contentByType).length === 0 && (
                <Typography variant="body1" color="text.secondary" align="center">
                    No content has been added to this topic yet.
                </Typography>
            )}

            {/* Add CommentSection */}
            <CommentSection topicId={topicId} />
        </Box>
    );
};

export default TopicDetail; 