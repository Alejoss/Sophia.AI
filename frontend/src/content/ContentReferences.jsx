import React from 'react';
import { Box, Typography, List, ListItem, ListItemText, Avatar } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/dateUtils';

const ContentReferences = ({ references }) => {
    const navigate = useNavigate();

    if (!references) return null;

    return (
        <Box>
            {/* Knowledge Paths */}
            {references.knowledge_paths?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                        Rutas de conocimiento
                    </Typography>
                    <List>
                        {references.knowledge_paths.map((path) => (
                            <ListItem 
                                key={path.id}
                                component="button"
                                onClick={() => navigate(`/knowledge_path/${path.id}`)}
                                sx={{ 
                                    width: '100%', 
                                    textAlign: 'left',
                                    bgcolor: 'transparent',
                                    '&:hover': {
                                        bgcolor: 'action.hover'
                                    }
                                }}
                            >
                                <Avatar 
                                    src={path.image} 
                                    alt={path.title}
                                    sx={{ 
                                        width: 40, 
                                        height: 40, 
                                        mr: 2,
                                        bgcolor: 'grey.300'
                                    }}
                                >
                                    {path.title.charAt(0).toUpperCase()}
                                </Avatar>
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
                        Temas
                    </Typography>
                    <List>
                        {references.topics.map((topic) => (
                            <ListItem 
                                key={topic.id}
                                component="button"
                                onClick={() => navigate(`/content/topics/${topic.id}`)}
                                sx={{ 
                                    width: '100%', 
                                    textAlign: 'left',
                                    bgcolor: 'transparent',
                                    '&:hover': {
                                        bgcolor: 'action.hover'
                                    }
                                }}
                            >
                                <Avatar 
                                    src={topic.topic_image} 
                                    alt={topic.title}
                                    sx={{ 
                                        width: 40, 
                                        height: 40, 
                                        mr: 2,
                                        bgcolor: 'grey.300'
                                    }}
                                >
                                    {topic.title.charAt(0).toUpperCase()}
                                </Avatar>
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
                        Publicaciones
                    </Typography>
                    <List>
                        {references.publications.map((pub) => (
                            <ListItem 
                                key={pub.id}
                                component="button"
                                onClick={() => navigate(`/publications/${pub.id}`)}
                                sx={{ 
                                    width: '100%', 
                                    textAlign: 'left',
                                    bgcolor: 'transparent',
                                    '&:hover': {
                                        bgcolor: 'action.hover'
                                    }
                                }}
                            >
                                <Avatar 
                                    src={pub.profile_picture || '/default-avatar.png'} 
                                    alt={pub.username}
                                    sx={{ 
                                        width: 40, 
                                        height: 40, 
                                        mr: 2,
                                        bgcolor: 'grey.300'
                                    }}
                                >
                                    {pub.username.charAt(0).toUpperCase()}
                                </Avatar>
                                <ListItemText 
                                    primary={`Publicación por ${pub.username}`}
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
                    Este contenido no está referenciado en ninguna ruta de conocimiento, tema o publicación.
                </Typography>
            )}
        </Box>
    );
};

export default ContentReferences; 