import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Card,
    TextField,
    Button,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    Divider,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { formatDate } from '../utils/dateUtils';
import contentApi from '../api/contentApi';

const ContentEdit = () => {
    const { contentId } = useParams();
    const navigate = useNavigate();
    const [content, setContent] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        author: '',
        personal_note: '',
    });
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const data = await contentApi.getContentDetails(contentId);
                setContent(data);
                const profile = data.selected_profile;
                setFormData({
                    title: profile?.title || data.original_title || '',
                    author: profile?.author || data.original_author || '',
                    personal_note: profile?.personal_note || '',
                });
            } catch (err) {
                setError('Failed to load content');
                console.error(err);
            }
        };
        fetchContent();
    }, [contentId]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await contentApi.updateContentProfile(content.selected_profile.id, formData);
            navigate(`/content/${contentId}/library`);
        } catch (err) {
            setError('Failed to update content');
            console.error(err);
        }
    };

    const handleDelete = async () => {
        try {
            await contentApi.deleteContent(contentId);
            navigate('/content/library_user');
        } catch (err) {
            setError('Failed to delete content');
            console.error(err);
        }
    };

    if (!content) return <div>Loading...</div>;

    return (
        <Box sx={{ maxWidth: 800, margin: '0 auto', padding: 2, pt: 12 }}>
            <Card sx={{ padding: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Edit Content
                </Typography>

                {error && (
                    <Typography color="error" sx={{ mb: 2 }}>
                        {error}
                    </Typography>
                )}

                {/* Content Information Display */}
                <Box sx={{ mb: 4 }}>
                    <Box sx={{ mb: 2 }}>
                        <Chip 
                            label={content.media_type} 
                            color="primary" 
                            sx={{ mr: 1 }}
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Uploaded: {formatDate(content.created_at)}
                        </Typography>
                    </Box>

                    {/* File Preview Section */}
                    {content.media_type === 'IMAGE' && content.file_details?.file && (
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" gutterBottom>
                                Preview:
                            </Typography>
                            <img 
                                src={`http://localhost:8000${content.file_details.file}`}
                                alt="Content preview"
                                style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
                            />
                        </Box>
                    )}

                    {/* File Details */}
                    {content.file_details && (
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" gutterBottom>
                                File Details:
                            </Typography>
                            <Typography variant="body2">
                                Size: {(content.file_details.file_size / 1024 / 1024).toFixed(2)} MB
                            </Typography>
                            <Button
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                href={`http://localhost:8000${content.file_details.file}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                                sx={{ mt: 1 }}
                            >
                                Download File
                            </Button>
                        </Box>
                    )}
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* Edit Form */}
                <form onSubmit={handleSubmit}>
                    <TextField
                        fullWidth
                        label="Title"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        margin="normal"
                        helperText={content.original_title && `Original title: ${content.original_title}`}
                    />
                    <TextField
                        fullWidth
                        label="Author"
                        name="author"
                        value={formData.author}
                        onChange={handleChange}
                        margin="normal"
                        helperText={content.original_author && `Original author: ${content.original_author}`}
                    />
                    <TextField
                        fullWidth
                        label="Personal Note"
                        name="personal_note"
                        value={formData.personal_note}
                        onChange={handleChange}
                        margin="normal"
                        multiline
                        rows={4}
                    />

                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                        <Button
                            variant="contained"
                            color="error"
                            onClick={() => setDeleteDialogOpen(true)}
                        >
                            Delete Content
                        </Button>
                        <Box>
                            <Button
                                variant="outlined"
                                onClick={() => navigate(`/content/${contentId}/library`)}
                                sx={{ mr: 1 }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                type="submit"
                            >
                                Save Changes
                            </Button>
                        </Box>
                    </Box>
                </form>
            </Card>

            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
            >
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    Are you sure you want to delete this content? This action cannot be undone.
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleDelete} color="error">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ContentEdit; 