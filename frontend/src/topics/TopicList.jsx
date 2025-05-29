import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    Grid, 
    Card, 
    CardContent, 
    CardMedia, 
    CardActionArea,
    Button,
    Alert,
    CircularProgress 
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import contentApi from '../api/contentApi';
import { isAuthenticated } from '../context/localStorageUtils';

const TopicList = () => {
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchTopics = async () => {
            try {
                const data = await contentApi.getTopics();
                setTopics(data);
                setLoading(false);
            } catch (err) {
                setError('Failed to fetch topics');
                setLoading(false);
            }
        };

        fetchTopics();
    }, []);

    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 12 }}>
            <CircularProgress />
        </Box>
    );

    if (error) return (
        <Box sx={{ pt: 12, px: 3 }}>
            <Alert severity="error">{error}</Alert>
        </Box>
    );

    return (
        <Box sx={{ pt: 12, px: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4" component="h1">
                    Topics
                </Typography>
                {isAuthenticated() && (
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={() => navigate('/content/create_topic')}
                    >
                        Create Topic
                    </Button>
                )}
            </Box>

            <Grid container spacing={3}>
                {topics.map((topic) => (
                    <Grid item xs={12} sm={6} md={4} key={topic.id}>
                        <Card>
                            <CardActionArea onClick={() => navigate(`/content/topics/${topic.id}`)}>
                                <CardMedia
                                    component="img"
                                    height="140"
                                    image={topic.topic_image || `https://picsum.photos/800/400?random=${topic.id}`}
                                    alt={topic.title}
                                    sx={{ objectFit: 'cover' }}
                                />
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        {topic.title}
                                    </Typography>
                                    {topic.description && (
                                        <Typography variant="body2" color="text.secondary" noWrap>
                                            {topic.description}
                                        </Typography>
                                    )}
                                </CardContent>
                            </CardActionArea>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};

export default TopicList; 