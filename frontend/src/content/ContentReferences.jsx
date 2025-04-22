import React from 'react';
import { Box, Typography, List, ListItem, ListItemText } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/dateUtils';

const ContentReferences = ({ references }) => {
    const navigate = useNavigate();

    if (!references) return null;

    return (
        <Box>
            <Typography variant="h6" gutterBottom color="text.secondary">
                Content References
            </Typography>

            {/* Knowledge Paths */}
            {references.knowledge_paths?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                        Knowledge Paths
                    </Typography>
                    <List>
                        {references.knowledge_paths.map((path) => (
                            <ListItem 
                                key={path.id}
                                component="button"
                                onClick={() => navigate(`/knowledge_path/${path.id}`)}
                                sx={{ width: '100%', textAlign: 'left' }}
                            >
                                <ListItemText primary={path.title} />
                            </ListItem>
                        ))}
                    </List>
                </Box>
            )}

            {/* Topics */}
            {references.topics?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                        Topics
                    </Typography>
                    <List>
                        {references.topics.map((topic) => (
                            <ListItem 
                                key={topic.id}
                                component="button"
                                onClick={() => navigate(`/content/topics/${topic.id}`)}
                                sx={{ width: '100%', textAlign: 'left' }}
                            >
                                <ListItemText primary={topic.title} />
                            </ListItem>
                        ))}
                    </List>
                </Box>
            )}

            {/* Publications */}
            {references.publications?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                        Publications
                    </Typography>
                    <List>
                        {references.publications.map((pub) => (
                            <ListItem 
                                key={pub.id}
                                component="button"
                                onClick={() => navigate(`/publications/${pub.id}`)}
                                sx={{ width: '100%', textAlign: 'left' }}
                            >
                                <ListItemText 
                                    primary={`Publication by ${pub.username}`}
                                    secondary={formatDate(pub.published_at)}
                                />
                            </ListItem>
                        ))}
                    </List>
                </Box>
            )}

            {/* No References Message */}
            {!references.knowledge_paths?.length && 
             !references.topics?.length && 
             !references.publications?.length && (
                <Typography color="text.secondary">
                    This content is not referenced in any knowledge paths, topics, or publications.
                </Typography>
            )}
        </Box>
    );
};

export default ContentReferences; 