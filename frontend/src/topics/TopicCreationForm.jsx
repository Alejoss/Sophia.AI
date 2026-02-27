import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Grid, TextField, Button, Typography, Paper, Alert } from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
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
            setError(null);
            const topicId = response?.id ?? response?.data?.id;
            if (topicId) {
                navigate(`/content/topics/${topicId}/edit`, { replace: true });
                return;
            }
            setSuccess(true);
            setFormData({ title: '', description: '' });
        } catch (err) {
            setError(err.response?.data?.error || 'Error al crear el tema');
            setSuccess(false);
        }
    };

    return (
        <Box
            sx={{
                pt: { xs: 2, md: 4 },
                px: { xs: 1, md: 3 },
                maxWidth: 1000,
                mx: 'auto',
                color: 'text.primary',
            }}
        >
            <Grid container spacing={3}>
                {/* Left column: form */}
                <Grid item xs={12} md={7}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography
                            variant="h4"
                            gutterBottom
                            color="text.primary"
                            sx={{
                                fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
                                fontWeight: 400,
                                fontSize: {
                                    xs: '20px',
                                    sm: '24px',
                                    md: '24px',
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
                                label="Título del tema"
                                placeholder="Elige un tema no muy amplio"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                helperText="Un buen tema trata sobre algo de algo."
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
                </Grid>

                {/* Right column: educational card */}
                <Grid item xs={12} md={5}>
                    <Paper
                        sx={{
                            p: 3,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.5,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Box
                                sx={{
                                    mr: 1.5,
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    bgcolor: 'primary.light',
                                    color: 'primary.contrastText',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <LightbulbIcon fontSize="small" />
                            </Box>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                ¿Cómo crear un buen tema?
                            </Typography>
                        </Box>

                        <Typography variant="body2" color="text.secondary">
                            Un buen tema es específico y permite desarrollar contenido enfocado.
                        </Typography>

                        <Box sx={{ mt: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Recomendaciones:
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Se restringe a un aspecto concreto.
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Incluye contexto (lugar, tiempo o enfoque).
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Permite conectar contenido específico.
                            </Typography>
                        </Box>

                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Evita títulos amplios como:
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Terrorismo
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Medicina
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Política
                            </Typography>
                        </Box>

                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Mejores ejemplos:
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Beneficios del consumo de miel para la salud
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • La verdad sobre el ataque terrorista de Oklahoma 
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Radicalización online en los jóvenes
                            </Typography>
                        </Box>

                        <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                Pregúntate: ¿Alguien podría aportar contenido sobre este tema, sin preguntarte de qué se trata?
                            </Typography>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default TopicCreationForm; 