import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    TextField, 
    Button, 
    Paper, 
    Avatar, 
    CircularProgress,
    Chip,
    FormHelperText,
    InputAdornment
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import InterestsIcon from '@mui/icons-material/Interests';
import DescriptionIcon from '@mui/icons-material/Description';
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
        interests: [],
        external_url: '',
        profile_picture: null
    });
    const [previewUrl, setPreviewUrl] = useState(null);
    const [interestInput, setInterestInput] = useState('');
    const MAX_DESCRIPTION_LENGTH = 500;
    const MAX_INTERESTS = 10;

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const profile = await getUserProfile();
                // Convertir interests string a array
                const interestsArray = profile.interests 
                    ? profile.interests.split(',').map(i => i.trim()).filter(i => i)
                    : [];
                
                setFormData({
                    username: profile.user.username,
                    profile_description: profile.profile_description || '',
                    interests: interestsArray,
                    external_url: profile.external_url || '',
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

    const handleInterestInputKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addInterest();
        } else if (e.key === 'Backspace' && interestInput === '' && formData.interests.length > 0) {
            // Si el input está vacío y presiona backspace, eliminar el último tag
            removeInterest(formData.interests.length - 1);
        }
    };

    const handleInterestInputChange = (e) => {
        const value = e.target.value;
        // Si el usuario escribe una coma, crear el tag automáticamente
        if (value.endsWith(',')) {
            const tagValue = value.slice(0, -1).trim();
            if (tagValue) {
                addInterestFromValue(tagValue);
                setInterestInput('');
            }
        } else {
            setInterestInput(value);
        }
    };

    const addInterest = () => {
        if (interestInput.trim()) {
            addInterestFromValue(interestInput.trim());
            setInterestInput('');
        }
    };

    const addInterestFromValue = (value) => {
        if (formData.interests.length >= MAX_INTERESTS) {
            return;
        }

        const normalizedValue = value.trim();
        if (!normalizedValue) return;

        // Verificar si ya existe (case-insensitive)
        const exists = formData.interests.some(
            tag => tag.toLowerCase() === normalizedValue.toLowerCase()
        );

        if (!exists) {
            setFormData(prev => ({
                ...prev,
                interests: [...prev.interests, normalizedValue]
            }));
        } else {
            setInterestInput('');
        }
    };

    const removeInterest = (indexToRemove) => {
        setFormData(prev => ({
            ...prev,
            interests: prev.interests.filter((_, index) => index !== indexToRemove)
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
            // Convertir array de interests a string separado por comas
            formDataToSend.append('interests', formData.interests.join(', '));
            if (formData.external_url) {
                formDataToSend.append('external_url', formData.external_url);
            }
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

    const remainingChars = MAX_DESCRIPTION_LENGTH - formData.profile_description.length;

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3, maxWidth: 700, mx: 'auto' }}>
            <Paper elevation={3} sx={{ p: 4 }}>
                <Typography 
                    variant="h4" 
                    gutterBottom 
                    color="text.primary"
                    sx={{
                        fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
                        fontWeight: 400,
                        fontSize: "24px",
                        mb: 3
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
                    {/* Foto de perfil */}
                    <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Avatar
                            src={previewUrl || '/default-avatar.png'}
                            sx={{ width: 120, height: 120, mb: 2 }}
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

                    {/* Nombre de usuario (deshabilitado) */}
                    <TextField
                        name="username"
                        label="Nombre de usuario"
                        value={formData.username}
                        fullWidth
                        disabled
                        sx={{ mb: 3 }}
                    />

                    {/* URL Externa */}
                    <TextField
                        name="external_url"
                        label="Sitio web o enlace externo"
                        value={formData.external_url}
                        onChange={handleInputChange}
                        fullWidth
                        placeholder="https://tu-sitio-web.com"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <LinkIcon color="action" />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ mb: 3 }}
                        helperText="Comparte tu sitio web, blog, portafolio o cualquier enlace relevante"
                    />

                    {/* Intereses como Tags */}
                    <Box>
                        <TextField
                            label="Intereses"
                            value={interestInput}
                            onChange={handleInterestInputChange}
                            onKeyDown={handleInterestInputKeyDown}
                            fullWidth
                            placeholder={formData.interests.length === 0 
                                ? "Escribe un interés y presiona Enter o coma (,) para agregar"
                                : "Escribe otro interés..."
                            }
                            helperText={
                                formData.interests.length >= MAX_INTERESTS
                                    ? `Límite alcanzado (${MAX_INTERESTS} intereses)`
                                    : `${formData.interests.length}/${MAX_INTERESTS} intereses. Escribe y presiona Enter o coma (,) para agregar`
                            }
                            disabled={formData.interests.length >= MAX_INTERESTS}
                            InputProps={{
                                startAdornment: (
                                    <>
                                        <InputAdornment position="start">
                                            <InterestsIcon color="action" />
                                        </InputAdornment>
                                        {formData.interests.length > 0 && (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, ml: 1 }}>
                                                {formData.interests.map((interest, index) => (
                                                    <Chip
                                                        key={index}
                                                        label={interest}
                                                        onDelete={() => removeInterest(index)}
                                                        variant="outlined"
                                                        color="primary"
                                                        size="small"
                                                    />
                                                ))}
                                            </Box>
                                        )}
                                    </>
                                ),
                            }}
                            sx={{ mb: 1 }}
                        />
                        {formData.interests.length > 0 && (
                            <FormHelperText sx={{ mt: -1, mb: 2, color: 'text.secondary', fontSize: '0.75rem' }}>
                                💡 Tip: Escribe y presiona Enter o coma (,) para crear un tag. Presiona la X en un tag para eliminarlo.
                            </FormHelperText>
                        )}
                    </Box>

                    {/* Descripción con límite de caracteres */}
                    <TextField
                        name="profile_description"
                        label="Sobre ti"
                        value={formData.profile_description}
                        onChange={handleInputChange}
                        multiline
                        rows={5}
                        fullWidth
                        inputProps={{ maxLength: MAX_DESCRIPTION_LENGTH }}
                        placeholder="Cuéntanos quién eres, qué te apasiona y qué aportas a la comunidad. Sé auténtico y comparte lo que te hace único en el mundo de la tecnología y blockchain."
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                                    <DescriptionIcon color="action" />
                                </InputAdornment>
                            ),
                        }}
                        helperText={
                            <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <span>Comparte tu historia y conecta con otros miembros de la comunidad</span>
                                <span style={{ 
                                    color: remainingChars < 50 ? 'warning.main' : 'text.secondary',
                                    fontWeight: remainingChars < 50 ? 600 : 400
                                }}>
                                    {remainingChars} caracteres restantes
                                </span>
                            </Box>
                        }
                        sx={{ mb: 3 }}
                    />

                    {/* Botones de acción */}
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 4 }}>
                        <Button
                            type="button"
                            onClick={() => navigate('/profiles/my_profile')}
                            variant="outlined"
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
