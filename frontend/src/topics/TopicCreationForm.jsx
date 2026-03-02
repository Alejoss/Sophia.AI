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
                            Crear un Tema es un ejercicio de curaduría: eliges y organizas el mejor contenido que has encontrado sobre algo que te importa.
                        </Typography>

                        <Box sx={{ mt: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Piensa en esto cuando definas el título:
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Se restringe a un aspecto concreto, no a “todo sobre X”.
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Incluye contexto (lugar, tiempo o enfoque).
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Permite conectar contenido específico que realmente quieras guardar y compartir.
                            </Typography>
                        </Box>

                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Evita títulos demasiado amplios como:
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
                                Mejores ejemplos de temas:
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
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Preguntas que pueden ayudarte:
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • ¿Cuál es el mejor contenido que he encontrado sobre esto?
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • ¿Qué me habría gustado tener organizado en un solo lugar?
                            </Typography>                        
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default TopicCreationForm; 