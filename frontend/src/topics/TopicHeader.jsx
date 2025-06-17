import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    Paper, 
    Button
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { isAuthenticated, getUserFromLocalStorage } from '../context/localStorageUtils';

const TopicHeader = ({ topic, onEdit }) => {
    const navigate = useNavigate();
    const user = getUserFromLocalStorage();
    const isCreator = isAuthenticated() && topic.creator === user?.id;

    const handleTitleClick = () => {
        navigate(`/content/topics/${topic.id}`);
    };

    return (
        <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, mb: 3 }}>
                {/* Topic Image */}
                <Box sx={{ width: 200, height: 200 }}>
                    <img
                        src={topic.topic_image || `https://picsum.photos/400/400?random=${topic.id}`}
                        alt={topic.title}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '4px'
                        }}
                    />
                </Box>

                {/* Topic Info */}
                <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Typography 
                            variant="h4" 
                            gutterBottom
                            onClick={handleTitleClick}
                            sx={{ 
                                cursor: 'pointer',
                                '&:hover': {
                                    color: 'primary.main'
                                }
                            }}
                        >
                            {topic.title}
                        </Typography>
                        {isCreator && (
                            <Button
                                variant="outlined"
                                startIcon={<EditIcon />}
                                onClick={onEdit}
                            >
                                Edit Topic
                            </Button>
                        )}
                    </Box>
                    {topic.description && (
                        <Typography variant="body1" sx={{ mt: 2 }}>
                            {topic.description}
                        </Typography>
                    )}
                </Box>
            </Box>
        </Paper>
    );
};

export default TopicHeader; 