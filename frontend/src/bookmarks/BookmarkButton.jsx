import React, { useState, useEffect } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { checkBookmarkStatus, toggleBookmark } from '../api/bookmarkApi';

// Map frontend types to Django model names
const contentTypeMap = {
    'content': 'content',
    'knowledgepath': 'knowledgepath',
    'publication': 'publication'
};

const BookmarkButton = ({ 
    // Support both property structures
    type, 
    ids, 
    // Direct props used in newer components
    contentId,
    contentType,
    topicId,
    initialIsBookmarked = false 
}) => {
    const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);
    const [isLoading, setIsLoading] = useState(true);

    // Determine which props to use
    const actualContentId = contentId || (ids && ids.contentId);
    const actualContentType = contentType || type;
    const actualTopicId = topicId || (ids && ids.topicId);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                // Input validation
                if (!actualContentId) {
                    console.error('Missing content ID for bookmark status check');
                    setIsLoading(false);
                    return;
                }

                const mappedContentType = contentTypeMap[actualContentType];
                if (!mappedContentType) {
                    console.error(`Invalid content type: ${actualContentType}`);
                    setIsLoading(false);
                    return;
                }

                const response = await checkBookmarkStatus(actualContentId, mappedContentType, actualTopicId);
                setIsBookmarked(response.is_bookmarked);
            } catch (error) {
                console.error('Error checking bookmark status:', error);
            } finally {
                setIsLoading(false);
            }
        };
        checkStatus();
    }, [actualContentId, actualContentType, actualTopicId]);

    const handleToggle = async () => {
        try {
            // Input validation
            if (!actualContentId) {
                console.error('Missing content ID for bookmark toggle');
                return;
            }

            setIsLoading(true);
            const mappedContentType = contentTypeMap[actualContentType];
            if (!mappedContentType) {
                console.error(`Invalid content type: ${actualContentType}`);
                setIsLoading(false);
                return;
            }

            const response = await toggleBookmark(actualContentId, mappedContentType, actualTopicId);
            setIsBookmarked(response.is_bookmarked);
        } catch (error) {
            console.error('Error toggling bookmark:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <IconButton disabled>
                <BookmarkBorderIcon />
            </IconButton>
        );
    }

    return (
        <Tooltip title={isBookmarked ? "Remove bookmark" : "Add bookmark"}>
            <IconButton onClick={handleToggle} color={isBookmarked ? "primary" : "default"}>
                {isBookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
            </IconButton>
        </Tooltip>
    );
};

export default BookmarkButton; 