import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Box, Typography, Paper, Button, Chip, Divider, Alert, IconButton, Modal, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import contentApi from '../api/contentApi';

const ImageUploadModal = ({ open, handleClose, handleImageUpload }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [error, setError] = useState(null);

    const validateFile = (file) => {
        const maxSize = 2 * 1024 * 1024; // 2MB in bytes
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];

        if (!allowedTypes.includes(file.type)) {
            return 'File must be an image (JPEG, PNG, or GIF)';
        }

        if (file.size > maxSize) {
            return 'File size must be less than 2MB';
        }

        return null;
    };

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            const validationError = validateFile(file);
            if (validationError) {
                setError(validationError);
                setSelectedFile(null);
            } else {
                setError(null);
                setSelectedFile(file);
            }
        }
    };

    const handleUpload = () => {
        if (selectedFile) {
            handleImageUpload(selectedFile);
            handleClose();
            setSelectedFile(null);
            setError(null);
        }
    };

    return (
        <Modal
            open={open}
            onClose={handleClose}
            aria-labelledby="image-upload-modal"
        >
            <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 400,
                bgcolor: 'background.paper',
                borderRadius: 1,
                boxShadow: 24,
                p: 4,
            }}>
                <Typography variant="h6" gutterBottom>
                    Upload Topic Image
                </Typography>

                <List>
                    <ListItem>
                        <ListItemIcon>
                            {selectedFile ? <CheckCircleIcon color="success" /> : <ErrorIcon color="disabled" />}
                        </ListItemIcon>
                        <ListItemText 
                            primary="Select an image file"
                            secondary={selectedFile ? selectedFile.name : 'No file selected'}
                        />
                    </ListItem>
                    <ListItem>
                        <ListItemIcon>
                            <CheckCircleIcon color={selectedFile && selectedFile.size <= 2 * 1024 * 1024 ? "success" : "disabled"} />
                        </ListItemIcon>
                        <ListItemText primary="File size less than 2MB" />
                    </ListItem>
                </List>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                    <Button
                        variant="contained"
                        component="label"
                    >
                        Choose File
                        <input
                            type="file"
                            hidden
                            accept="image/*"
                            onChange={handleFileSelect}
                        />
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleUpload}
                        disabled={!selectedFile || error}
                    >
                        Upload Image
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={handleClose}
                    >
                        Cancel
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

const TopicEdit = () => {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const [topic, setTopic] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const fetchTopic = async () => {
            try {
                const data = await contentApi.getTopicDetails(topicId);
                setTopic(data);
                setLoading(false);
            } catch (err) {
                setError('Failed to fetch topic details');
                setLoading(false);
            }
        };

        fetchTopic();
    }, [topicId]);

    const handleImageUpload = async (file) => {
        const formData = new FormData();
        formData.append('topic_image', file);
        
        try {
            const updatedTopic = await contentApi.updateTopicImage(topicId, formData);
            setTopic(updatedTopic);
            setError(null);
        } catch (err) {
            setError('Failed to update topic image');
        }
    };

    if (loading) return <Typography>Loading topic details...</Typography>;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!topic) return <Alert severity="info">Topic not found</Alert>;

    return (
        <Box sx={{ pt: 12, px: 3, maxWidth: 800, mx: 'auto' }}>
            <Paper sx={{ p: 3, position: 'relative' }}>
                {/* View Topic Button */}
                <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}>
                    <Button
                        component={Link}
                        to={`/content/topics/${topicId}`}
                        startIcon={<OpenInNewIcon />}
                        variant="outlined"
                        size="small"
                    >
                        View Topic
                    </Button>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, mb: 3 }}>
                    {/* Topic Image */}
                    <Box sx={{ position: 'relative', width: 200, height: 200 }}>
                        <img
                            src={topic.topic_image || '/default-topic-image.png'}
                            alt={topic.title}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                borderRadius: '4px'
                            }}
                        />
                        <Button
                            component="span"
                            variant="contained"
                            startIcon={<EditIcon />}
                            onClick={() => setIsModalOpen(true)}
                            sx={{
                                position: 'absolute',
                                bottom: 8,
                                right: 8,
                                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)'
                                }
                            }}
                        >
                            Edit Image
                        </Button>
                    </Box>

                    {/* Topic Title and Description */}
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h4" gutterBottom>
                            {topic.title}
                        </Typography>
                        {topic.description && (
                            <Typography variant="body1">
                                {topic.description}
                            </Typography>
                        )}
                    </Box>
                </Box>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Topic Content
                    </Typography>
                    
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={() => navigate(`/content/topics/${topicId}/edit-content`)}
                        sx={{ mb: 2 }}
                    >
                        Edit Content in Topic
                    </Button>

                    {topic.contents?.length > 0 ? (
                        <Box sx={{ mt: 2 }}>
                            {/* We'll implement content display later */}
                            <Typography>
                                Content count: {topic.contents.length}
                            </Typography>
                        </Box>
                    ) : (
                        <Alert severity="info" sx={{ mt: 2 }}>
                            No content has been added to this topic yet.
                        </Alert>
                    )}
                </Box>
            </Paper>

            <ImageUploadModal 
                open={isModalOpen}
                handleClose={() => setIsModalOpen(false)}
                handleImageUpload={handleImageUpload}
            />
        </Box>
    );
};

export default TopicEdit; 