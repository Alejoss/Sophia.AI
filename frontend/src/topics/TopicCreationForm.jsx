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
            setError(err.response?.data?.error || 'Error al crear el tema');
            setSuccess(false);
        }
    };

    return (
        <Box sx={{ pt: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: 600, mx: 'auto', color: "text.primary" }}>
            <Paper sx={{ p: 3 }}>
           <Typography
  variant="h4"
  gutterBottom
  color="text.primary"
  sx={{
    fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
    fontWeight: 400,
    fontSize: {
      xs: "20px", // ~20px on mobile
      sm: "24px",  // ~24px on small screens
      md: "24px",    // ~24px on medium+
    },
  }}
>
                    Crear Nuevo Tema
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {success && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                        ¡Tema creado exitosamente!
                    </Alert>
                )}

                <form onSubmit={handleSubmit}>
                    <TextField
                        fullWidth
                        label="Título del Tema"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        required
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        fullWidth
                        label="Descripción"
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
                        Crear Tema
                    </Button>
                </form>
            </Paper>
        </Box>
    );
};

export default TopicCreationForm; 