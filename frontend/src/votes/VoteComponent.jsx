import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { IconButton, Typography, Box } from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import votesApi from '../api/votesApi';

const VoteComponent = ({ type, ids, initialVoteCount = 0, initialUserVote = 0 }) => {
    const [voteCount, setVoteCount] = useState(initialVoteCount);
    const [userVote, setUserVote] = useState(initialUserVote);
    const [loading, setLoading] = useState(false);

    // Update state when props change
    useEffect(() => {
        setVoteCount(initialVoteCount);
        setUserVote(initialUserVote);
    }, [initialVoteCount, initialUserVote]);

    const calculateVoteChange = (currentVote, action) => {
        // If upvoting
        if (action === 'upvote') {
            if (currentVote === 1) return { voteChange: -1, newUserVote: 0 }; // Remove upvote
            if (currentVote === -1) return { voteChange: 2, newUserVote: 1 }; // Change from downvote to upvote
            return { voteChange: 1, newUserVote: 1 }; // Add upvote
        }
        // If downvoting
        if (action === 'downvote') {
            if (currentVote === -1) return { voteChange: 1, newUserVote: 0 }; // Remove downvote
            if (currentVote === 1) return { voteChange: -2, newUserVote: -1 }; // Change from upvote to downvote
            return { voteChange: -1, newUserVote: -1 }; // Add downvote
        }
        return { voteChange: 0, newUserVote: currentVote };
    };

    const handleVote = async (action) => {
        if (loading) return;
        
        setLoading(true);

        try {
            let response;
            switch (type) {
                case 'content':
                    response = await votesApi.voteContent(ids.topicId, ids.contentId, action);
                    break;
                case 'comment':
                    response = await votesApi.voteComment(ids.commentId, action);
                    break;
                case 'knowledge_path':
                    response = await votesApi.voteKnowledgePath(ids.pathId, action);
                    break;
                default:
                    throw new Error('Invalid vote type');
            }
            
            // Update with server values
            const newVoteCount = Number(response.vote_count);
            const newUserVote = Number(response.vote);
            
            setVoteCount(newVoteCount);
            setUserVote(newUserVote);
        } catch (error) {
            console.error('Error in handleVote:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box display="flex" alignItems="center">
            <IconButton 
                onClick={() => handleVote('upvote')}
                color={userVote > 0 ? 'primary' : 'default'}
                disabled={loading}
            >
                <ThumbUpIcon />
            </IconButton>
            <Typography variant="body1" sx={{ mx: 1, minWidth: '20px', textAlign: 'center', color: 'text.primary' }}>
                {voteCount}
            </Typography>
            <IconButton 
                onClick={() => handleVote('downvote')}
                color={userVote < 0 ? 'primary' : 'default'}
                disabled={loading}
            >
                <ThumbDownIcon />
            </IconButton>
        </Box>
    );
};

VoteComponent.propTypes = {
    type: PropTypes.oneOf(['content', 'comment', 'knowledge_path']).isRequired,
    ids: PropTypes.object.isRequired,
    initialVoteCount: PropTypes.number,
    initialUserVote: PropTypes.number
};

export default VoteComponent; 