import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    IconButton,
    Button,
    Paper
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import contentApi from '../api/contentApi';
import { MEDIA_BASE_URL } from '../api/config';
import CommentSection from '../comments/CommentSection';
import VoteComponent from '../votes/VoteComponent';
import BookmarkButton from '../bookmarks/BookmarkButton';
import ContentDisplay from './ContentDisplay';
import AddToLibraryModal from '../components/AddToLibraryModal';
import TopicHeader from '../topics/TopicHeader';

// ContentDisplay Mode: "preview" - Basic preview for topic content detail
const ContentDetailsTopic = () => {
    const { contentId, topicId } = useParams();
    const navigate = useNavigate();
    const [content, setContent] = useState(null);
    const [topic, setTopic] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchContentAndTopic = async () => {
            try {
                console.log(`ContentDetailsTopic: Fetching content ${contentId} and topic ${topicId}...`);
                const [contentData, topicData] = await Promise.all([
                    contentApi.getContentDetails(contentId, 'topic', topicId),
                    contentApi.getTopicDetails(topicId)
                ]);
                
                setContent(contentData);
                setTopic(topicData);
                setLoading(false);
            } catch (err) {
                console.error('ContentDetailsTopic: Error fetching data:', err);
                console.error('ContentDetailsTopic: Error details:', {
                    message: err.message,
                    status: err.response?.status,
                    data: err.response?.data
                });
                setError('Failed to fetch content or topic details');
                setLoading(false);
            }
        };

        fetchContentAndTopic();
    }, [contentId, topicId]);

    const handleAddToLibrarySuccess = () => {
        // Refresh content data after adding to library
        contentApi.getContentDetails(contentId, 'topic', topicId)
            .then(updatedContent => {
                setContent(updatedContent);
            })
            .catch(err => {
                console.error('Error refreshing content:', err);
            });
    };

    if (loading) return <Typography>Loading content...</Typography>;
    if (error) return <Typography color="error">{error}</Typography>;
    if (!content || !topic) return <Typography>Content or topic not found</Typography>;

    return (
        <Box sx={{ pt: 4, px: 3, maxWidth: 1200, mx: 'auto' }}>
            {/* Back Button at the very top */}
            <Box sx={{ mb: 2 }}>
                <IconButton 
                    onClick={() => navigate(`/content/topics/${topicId}`)}
                    sx={{ 
                        mr: 2,
                        color: 'primary.main',
                        backgroundColor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        '&:hover': {
                            backgroundColor: 'primary.light',
                            color: 'primary.contrastText'
                        }
                    }}
                >
                    <ArrowBackIcon />
                </IconButton>
            </Box>

            <TopicHeader 
                topic={topic}
                onEdit={() => navigate(`/content/topics/${topicId}/edit`)}
                size="small"
            />

            <Paper sx={{ p: 3, mb: 4 }}>
                {/* Action Buttons */}
                <Box sx={{ 
                    display: 'flex', 
                    gap: 2, 
                    mb: 3,
                    '& .MuiButton-root': {
                        color: 'primary.main',
                        borderColor: 'primary.main',
                        '&:hover': {
                            borderColor: 'primary.dark',
                            backgroundColor: 'primary.light',
                            color: 'primary.dark'
                        }
                    },
                    '& .MuiIconButton-root': {
                        color: 'primary.main',
                        '&:hover': {
                            backgroundColor: 'primary.light'
                        }
                    }
                }}>
                    <AddToLibraryModal
                        content={content}
                        onSuccess={handleAddToLibrarySuccess}
                    />
                    <BookmarkButton
                        type="content"
                        ids={{
                            topicId: topicId,
                            contentId: contentId
                        }}
                        initialIsBookmarked={content.is_bookmarked}
                    />
                    <VoteComponent
                        type="content"
                        ids={{
                            topicId: topicId,
                            contentId: contentId
                        }}
                        initialVoteCount={content.vote_count || 0}
                        initialUserVote={content.user_vote || 0}
                    />
                </Box>

                {/* Debug logging for VoteComponent props */}
                {(() => {
                    console.log('=== ContentDetailsTopic: VoteComponent props ===');
                    console.log('VoteComponent props:', {
                        type: 'content',
                        ids: { topicId, contentId },
                        initialVoteCount: content.vote_count || 0,
                        initialUserVote: content.user_vote || 0,
                        voteCountType: typeof content.vote_count,
                        userVoteType: typeof content.user_vote,
                        voteCountValue: content.vote_count,
                        userVoteValue: content.user_vote
                    });
                    console.log('=== End ContentDetailsTopic VoteComponent props ===');
                    return null;
                })()}

                {/* Content Display */}
                <ContentDisplay 
                    content={content}
                    variant="preview"
                />
            </Paper>

            <CommentSection topicId={topicId} />
        </Box>
    );
};

export default ContentDetailsTopic; 