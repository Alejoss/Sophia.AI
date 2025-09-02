import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, TextField, Button, Typography, Paper, Alert } from '@mui/material';
import contentApi from '../api/contentApi';

const TopicCreationForm = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        title: '',
        description: ''
    });
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await contentApi.createTopic(formData);
            setSuccess(true);
            setError(null);
            // Clear form
            setFormData({ title: '', description: '' });
            // Redirect to topic edit page after successful creation
            setTimeout(() => navigate(`/content/topics/${response.id}/edit`), 2000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create topic');
            setSuccess(false);
        }
    };

    return (
        <Box sx={{ pt: 12, px: 3, maxWidth: 600, mx: 'auto' }}>
            <Paper sx={{ p: 3 }}>
           <Typography
  variant="h4"
  gutterBottom
  sx={{
    fontSize: {
      xs: "1.25rem", // ~20px on mobile
      sm: "1.5rem",  // ~24px on small screens
      md: "2rem",    // ~32px on medium+
    },
  }}
>
                    Create New Topic
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {success && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                        Topic created successfully!
                    </Alert>
                )}

                <form onSubmit={handleSubmit}>
                    <TextField
                        fullWidth
                        label="Topic Title"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        required
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        fullWidth
                        label="Description"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        multiline
                        rows={4}
                        sx={{ mb: 3 }}
                    />

                    <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        fullWidth
                    >
                        Create Topic
                    </Button>
                </form>
            </Paper>
        </Box>
    );
};

export default TopicCreationForm; 