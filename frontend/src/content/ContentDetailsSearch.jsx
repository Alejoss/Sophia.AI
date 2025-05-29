import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
import SearchIcon from '@mui/icons-material/Search';
import contentApi from '../api/contentApi';
import VoteComponent from '../votes/VoteComponent';
import ContentDisplay from './ContentDisplay';
import ContentReferences from './ContentReferences';

const ContentDetailsSearch = () => {
    const { contentId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [content, setContent] = useState(null);
    const [references, setReferences] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Get search query from location state
    const searchQuery = location.state?.searchQuery || '';

    useEffect(() => {
        const fetchContent = async () => {
            try {
                // Get profile ID from URL if present
                const searchParams = new URLSearchParams(location.search);
                const profileId = searchParams.get('profile');
                
                // Fetch content details
                const contentData = await contentApi.getContentDetails(contentId, 'search', profileId);
                setContent(contentData);
                
                // Fetch content references
                const referencesData = await contentApi.getContentReferences(contentId);
                setReferences(referencesData);
            } catch (err) {
                console.error('Error fetching content details:', err);
                setError('Failed to load content');
            } finally {
                setLoading(false);
            }
        };

        fetchContent();
    }, [contentId, location.search]);

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

    const handleBackToSearch = () => {
        navigate('/search', { state: { searchQuery } });
    };

    return (
        <Container maxWidth="lg" sx={{ pt: 12, pb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate(-1)}
                >
                    Back
                </Button>
                
                <Button
                    variant="contained"
                    startIcon={<SearchIcon />}
                    onClick={handleBackToSearch}
                >
                    Do Another Search
                </Button>
            </Box>

            {searchQuery && (
                <Paper sx={{ p: 2, mb: 3, bgcolor: 'info.light' }}>
                    <Typography variant="body1">
                        You are viewing this content as a result of searching for: <strong>"{searchQuery}"</strong>
                    </Typography>
                </Paper>
            )}

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
                        ids={{ contentId }}
                        initialVoteCount={content.vote_count}
                        initialUserVote={content.user_vote}
                    />
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Content Display */}
                <ContentDisplay 
                    content={content}
                    variant="detailed"
                    showAuthor={true}
                />
            </Paper>

            {/* Content References Section */}
            {references && (
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h5" gutterBottom>
                        References
                    </Typography>
                    <ContentReferences references={references} />
                </Paper>
            )}
        </Container>
    );
};

export default ContentDetailsSearch; 