import React, { useState, useEffect } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import votesApi from '../api/votesApi';

const VoteComponent = ({ topicId, contentId }) => {
    const [voteCount, setVoteCount] = useState(0);
    const [userVote, setUserVote] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchVoteStatus();
    }, [topicId, contentId]);

    const fetchVoteStatus = async () => {
        try {
            const response = await votesApi.getContentVoteStatus(topicId, contentId);
            setVoteCount(response.vote_count);
            setUserVote(response.vote);
        } catch (error) {
            console.error('Failed to fetch vote status:', error);
        }
    };

    const handleVote = async (isUpvote) => {
        if (loading) return;

        setLoading(true);
        try {
            const voteFunction = isUpvote ? votesApi.upvoteContent : votesApi.downvoteContent;
            const response = await voteFunction(topicId, contentId);
            
            // Refresh vote status after voting
            await fetchVoteStatus();
        } catch (error) {
            console.error('Failed to vote:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton 
                onClick={(e) => {
                    e.stopPropagation();  // Prevent event bubbling
                    handleVote(true);
                }}
                color={userVote === 1 ? "primary" : "default"}
                disabled={loading}
            >
                <ThumbUpIcon />
            </IconButton>
            
            <Typography 
                variant="body2" 
                sx={{ 
                    minWidth: '30px', 
                    textAlign: 'center',
                    color: voteCount > 0 ? 'success.main' : 
                           voteCount < 0 ? 'error.main' : 
                           'text.secondary'
                }}
            >
                {voteCount}
            </Typography>

            <IconButton 
                onClick={(e) => {
                    e.stopPropagation();  // Prevent event bubbling
                    handleVote(false);
                }}
                color={userVote === -1 ? "primary" : "default"}
                disabled={loading}
            >
                <ThumbDownIcon />
            </IconButton>
        </Box>
    );
};

export default VoteComponent; 