import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    Paper,
    Button,
    Divider,
    CircularProgress,
    Container
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import contentApi from '../api/contentApi';
import CommentSection from '../comments/CommentSection';
import VoteComponent from '../votes/VoteComponent';
import ContentDisplay from './ContentDisplay';
import { isAuthenticated, getUserFromLocalStorage } from '../context/localStorageUtils';

const ContentDetailsTopic = () => {
    const { contentId, topicId } = useParams();
    const navigate = useNavigate();
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const data = await contentApi.getContentDetails(contentId);
                setContent(data);
            } catch (err) {
                setError('Failed to load content');
            } finally {
                setLoading(false);
            }
        };

        fetchContent();
    }, [contentId]);

    if (loading) return (
        <Container sx={{ pt: 12, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
        </Container>
    );
    
    if (error) return (
        <Container sx={{ pt: 12 }}>
            <Typography color="error">{error}</Typography>
        </Container>
    );
    
    if (!content) return (
        <Container sx={{ pt: 12 }}>
            <Typography>Content not found</Typography>
        </Container>
    );

    const content_profile = {
        title: content.selected_profile?.title || content.original_title,
        author: content.selected_profile?.author || content.original_author,
        content: {
            id: content.id,
            media_type: content.media_type,
            file_details: content.file_details,
            url: content.file_details?.url
        }
    };

    return (
        <Container maxWidth="lg" sx={{ pt: 12, pb: 4 }}>
            <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate(`/content/topics/${topicId}`)}
                sx={{ mb: 3 }}
            >
                Back to Topic
            </Button>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                        <Typography variant="h4" gutterBottom>
                            {content.selected_profile?.title || content.original_title || 'Untitled Content'}
                        </Typography>

                        {content.selected_profile?.author && (
                            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                                By {content.selected_profile.author}
                            </Typography>
                        )}
                    </Box>
                    <VoteComponent 
                        type="content"
                        ids={{ topicId, contentId }}
                        initialVoteCount={content.vote_count}
                        initialUserVote={content.user_vote}
                    />
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Content Display */}
                <ContentDisplay 
                    content_profile={content_profile}
                    variant="detailed"
                    showAuthor={true}
                    showType={true}
                />

                {/* Personal Note Section */}
                {content.selected_profile?.personal_note && (
                    <Box sx={{ mt: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Personal Notes
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'rgba(0, 0, 0, 0.02)' }}>
                            <Typography variant="body1">
                                {content.selected_profile.personal_note}
                            </Typography>
                        </Paper>
                    </Box>
                )}
            </Paper>

            {/* Comments Section */}
            <CommentSection topicId={topicId} contentId={contentId} />
        </Container>
    );
};

export default ContentDetailsTopic; 