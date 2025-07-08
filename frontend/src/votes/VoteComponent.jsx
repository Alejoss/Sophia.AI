import React, { useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import { IconButton, Typography, Box } from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import votesApi from '../api/votesApi';
import { AuthContext } from '../context/AuthContext';

const VoteComponent = ({ type, ids, initialVoteCount = 0, initialUserVote = 0 }) => {
    const { authState } = useContext(AuthContext);
    const [voteCount, setVoteCount] = useState(Number(initialVoteCount) || 0);
    const [userVote, setUserVote] = useState(Number(initialUserVote) || 0);
    const [loading, setLoading] = useState(false);

    // Debug logging
    console.log('VoteComponent render:', {
        type,
        ids,
        initialVoteCount,
        initialUserVote,
        voteCount,
        userVote,
        loading,
        isAuthenticated: authState.isAuthenticated
    });

    // Update state when props change
    useEffect(() => {
        const newVoteCount = Number(initialVoteCount) || 0;
        const newUserVote = Number(initialUserVote) || 0;
        
        console.log('VoteComponent useEffect:', {
            initialVoteCount,
            initialUserVote,
            newVoteCount,
            newUserVote
        });
        
        setVoteCount(newVoteCount);
        setUserVote(newUserVote);
    }, [initialVoteCount, initialUserVote]);

    const calculateVoteChange = (currentVote, action) => {
        // If upvoting
        if (action === 'upvote') {
            if (currentVote === 1) {
                return { voteChange: -1, newUserVote: 0 }; // Remove upvote
            }
            if (currentVote === -1) {
                return { voteChange: 2, newUserVote: 1 }; // Change from downvote to upvote
            }
            return { voteChange: 1, newUserVote: 1 }; // Add upvote
        }
        // If downvoting
        if (action === 'downvote') {
            if (currentVote === -1) {
                return { voteChange: 1, newUserVote: 0 }; // Remove downvote
            }
            if (currentVote === 1) {
                return { voteChange: -2, newUserVote: -1 }; // Change from upvote to downvote
            }
            return { voteChange: -1, newUserVote: -1 }; // Add downvote
        }
        return { voteChange: 0, newUserVote: currentVote };
    };

    const handleVote = async (action) => {
        if (loading) {
            console.log('VoteComponent: Already loading, ignoring vote action');
            return;
        }
        
        // Check if user is authenticated
        if (!authState.isAuthenticated) {
            console.log('VoteComponent: User not authenticated, cannot vote');
            alert('Please log in to vote');
            return;
        }
        
        console.log('VoteComponent handleVote:', {
            action,
            type,
            ids,
            currentVoteCount: voteCount,
            currentUserVote: userVote,
            isAuthenticated: authState.isAuthenticated
        });
        
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
                case 'publication':
                    response = await votesApi.votePublication(ids.publicationId, action);
                    break;
                default:
                    throw new Error('Invalid vote type');
            }
            
            console.log('VoteComponent API response:', response);
            
            // Update with server values
            const newVoteCount = Number(response.vote_count) || 0;
            const newUserVote = Number(response.user_vote) || 0;
            
            console.log('VoteComponent updating state:', {
                newVoteCount,
                newUserVote,
                oldVoteCount: voteCount,
                oldUserVote: userVote
            });
            
            setVoteCount(newVoteCount);
            setUserVote(newUserVote);
        } catch (error) {
            console.error('Error in handleVote:', error);
            
            // Handle authentication errors
            if (error.response?.status === 401) {
                console.log('Authentication required for voting');
                // You might want to show a message to the user or redirect to login
                alert('Please log in to vote');
                return;
            }
            
            // Handle other errors
            alert('An error occurred while processing your vote. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const upvoteColor = userVote > 0 ? 'primary' : 'default';
    const downvoteColor = userVote < 0 ? 'primary' : 'default';
    const isDisabled = loading || !authState.isAuthenticated;

    return (
        <Box display="flex" alignItems="center">
            <IconButton 
                onClick={() => handleVote('upvote')}
                color={upvoteColor}
                disabled={isDisabled}
                className={upvoteColor === 'primary' ? 'MuiIconButton-colorPrimary' : ''}
                sx={{
                    color: upvoteColor === 'primary' ? '#1976d2 !important' : '#757575 !important',
                    '&.MuiIconButton-colorPrimary': {
                        color: '#1976d2 !important'
                    },
                    '&:hover': {
                        backgroundColor: upvoteColor === 'primary' ? 'primary.light' : 'action.hover'
                    }
                }}
            >
                <ThumbUpIcon />
            </IconButton>
            <Typography variant="body1" sx={{ mx: 1, minWidth: '20px', textAlign: 'center', color: 'text.primary' }}>
                {voteCount}
            </Typography>
            <IconButton 
                onClick={() => handleVote('downvote')}
                color={downvoteColor}
                disabled={isDisabled}
                className={downvoteColor === 'primary' ? 'MuiIconButton-colorPrimary' : ''}
                sx={{
                    color: downvoteColor === 'primary' ? '#1976d2 !important' : '#757575 !important',
                    '&.MuiIconButton-colorPrimary': {
                        color: '#1976d2 !important'
                    },
                    '&:hover': {
                        backgroundColor: downvoteColor === 'primary' ? 'primary.light' : 'action.hover'
                    }
                }}
            >
                <ThumbDownIcon />
            </IconButton>
        </Box>
    );
};

VoteComponent.propTypes = {
    type: PropTypes.oneOf(['content', 'comment', 'knowledge_path', 'publication']).isRequired,
    ids: PropTypes.object.isRequired,
    initialVoteCount: PropTypes.number,
    initialUserVote: PropTypes.number
};

export default VoteComponent; 