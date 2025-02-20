import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    List, 
    ListItem, 
    ListItemText, 
    ListItemIcon,
    Paper,
    Chip
} from '@mui/material';
import {
    Description as TextIcon,
    Image as ImageIcon,
    VideoLibrary as VideoIcon,
    AudioFile as AudioIcon
} from '@mui/icons-material';
import contentApi from '../api/contentApi';
import { formatDate } from '../utils/dateUtils';

const getIcon = (mediaType) => {
    switch (mediaType?.toUpperCase()) {
        case 'IMAGE':
            return <ImageIcon />;
        case 'VIDEO':
            return <VideoIcon />;
        case 'AUDIO':
            return <AudioIcon />;
        default:
            return <TextIcon />;
    }
};

const ContentRecentlyUploaded = ({ refreshTrigger }) => {
    const [recentContent, setRecentContent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchRecentContent = async () => {
            try {
                const data = await contentApi.getRecentContent();
                setRecentContent(data);
            } catch (err) {
                setError('Failed to load recent content');
                console.error('Error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchRecentContent();
    }, [refreshTrigger]);

    if (loading) return <Box>Loading recent uploads...</Box>;
    if (error) return <Box color="error.main">{error}</Box>;

    return (
        <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
                Recently Uploaded
            </Typography>
            
            {recentContent.length === 0 ? (
                <Typography color="text.secondary">
                    No content uploaded yet
                </Typography>
            ) : (
                <List>
                    {recentContent.map((item) => (
                        <ListItem 
                            key={item.id}
                            component={Link}
                            to={`/content/library/${item.content.id}`}
                            sx={{
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                textDecoration: 'none',
                                color: 'inherit',
                                '&:hover': {
                                    bgcolor: 'action.hover',
                                }
                            }}
                        >
                            <ListItemIcon>
                                {getIcon(item.content.media_type)}
                            </ListItemIcon>
                            <ListItemText
                                primary={item.title || 'Untitled'}
                                secondary={
                                    <Box>
                                        <Typography variant="caption" display="block">
                                            {formatDate(item.content.created_at)}
                                        </Typography>
                                        <Chip 
                                            size="small"
                                            label={item.content.media_type}
                                            sx={{ mt: 0.5 }}
                                        />
                                    </Box>
                                }
                            />
                        </ListItem>
                    ))}
                </List>
            )}
        </Paper>
    );
};

export default ContentRecentlyUploaded; 