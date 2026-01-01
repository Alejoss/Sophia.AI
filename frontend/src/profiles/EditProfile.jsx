import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, TextField, Button, Paper, Avatar, CircularProgress } from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import { getUserProfile, updateProfile } from '../api/profilesApi';

const EditProfile = () => {
    const navigate = useNavigate();
    const { authState } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        profile_description: '',
        profile_picture: null
    });
    const [previewUrl, setPreviewUrl] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const profile = await getUserProfile();
                setFormData({
                    username: profile.user.username,
                    profile_description: profile.profile_description || '',
                    profile_picture: null
                });
                setPreviewUrl(profile.profile_picture);
                setError(null);
            } catch (err) {
                setError('Error al cargar el perfil');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({
                ...prev,
                profile_picture: file
            }));
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            const formDataToSend = new FormData();
            formDataToSend.append('profile_description', formData.profile_description);
            if (formData.profile_picture) {
                formDataToSend.append('profile_picture', formData.profile_picture);
            }

            await updateProfile(formDataToSend);
            navigate('/profiles/my_profile');
        } catch (err) {
            setError('Error al actualizar el perfil');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
            <Paper elevation={3} sx={{ p: 3 }}>
                <Typography 
                    variant="h4" 
                    gutterBottom 
                    color="text.primary"
                    sx={{
                        fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
                        fontWeight: 400,
                        fontSize: "24px"
                    }}
                >
                    Editar perfil
                </Typography>

                {error && (
                    <Typography color="error" sx={{ mb: 2 }}>
                        {error}
                    </Typography>
                )}

                <form onSubmit={handleSubmit}>
                    <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Avatar
                            src={previewUrl || '/default-avatar.png'}
                            sx={{ width: 100, height: 100, mb: 2 }}
                        />
                        <Button
                            variant="outlined"
                            component="label"
                        >
                            Cambiar foto de perfil
                            <input
                                type="file"
                                hidden
                                accept="image/*"
                                onChange={handleImageChange}
                            />
                        </Button>
                    </Box>

                    <TextField
                        name="username"
                        label="Nombre de usuario"
                        value={formData.username}
                        fullWidth
                        disabled
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        name="profile_description"
                        label="Descripción del perfil"
                        value={formData.profile_description}
                        onChange={handleInputChange}
                        multiline
                        rows={4}
                        fullWidth
                        sx={{ mb: 3 }}
                    />

                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        <Button
                            type="button"
                            onClick={() => navigate('/profiles/my_profile')}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={saving}
                        >
                            {saving ? 'Guardando...' : 'Guardar cambios'}
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
};

export default EditProfile; 