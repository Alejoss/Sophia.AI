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
                setError('Failed to load profile');
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
            setError('Failed to update profile');
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
                <Typography variant="h4" gutterBottom>
                    Edit Profile
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
                            Change Profile Picture
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
                        label="Username"
                        value={formData.username}
                        fullWidth
                        disabled
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        name="profile_description"
                        label="Profile Description"
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
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
};

export default EditProfile; 