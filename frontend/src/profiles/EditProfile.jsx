import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
    Box,
    Typography,
    TextField,
    Button,
    Paper,
    CircularProgress,
    Chip,
    FormHelperText,
    InputAdornment,
    Alert,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import InterestsIcon from '@mui/icons-material/Interests';
import DescriptionIcon from '@mui/icons-material/Description';
import { AuthContext } from '../context/AuthContext';
import { getAccessTokenFromLocalStorage } from '../context/localStorageUtils';
import { getUserProfile, updateProfile } from '../api/profilesApi';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';
import { bindMuiRhfField } from '../utils/muiRhfField';
import UserAvatar from '../components/UserAvatar';

const MAX_DESCRIPTION_LENGTH = 500;
const MAX_INTERESTS = 10;
const MAX_USERNAME_CHANGES = 2;

/**
 * Profile edit — if username changes and API returns user, updateAuthState with
 * existing access token (do not touch refresh cookie; never log tokens).
 */
const EditProfile = () => {
    const { t } = useTranslation('auth');
    const schema = useMemo(
        () =>
            yup.object({
                username: yup
                    .string()
                    .trim()
                    .required(() => t('edit.usernameRequired'))
                    .min(3, () => t('edit.usernameMin'))
                    .matches(/^[a-zA-Z0-9_]+$/, () => t('edit.usernameCharset')),
                profile_description: yup
                    .string()
                    .max(MAX_DESCRIPTION_LENGTH, () =>
                        t('edit.descriptionMax', { max: MAX_DESCRIPTION_LENGTH }),
                    ),
                external_url: yup
                    .string()
                    .trim()
                    .test(
                        'url-or-empty',
                        () => t('edit.invalidUrl'),
                        (value) => {
                            if (!value) return true;
                            try {
                                // eslint-disable-next-line no-new
                                new URL(value);
                                return true;
                            } catch {
                                return false;
                            }
                        },
                    ),
            }),
        [t],
    );
    const navigate = useNavigate();
    const { updateAuthState } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [generalError, setGeneralError] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [interestInput, setInterestInput] = useState('');
    const [interests, setInterests] = useState([]);
    const [profilePicture, setProfilePicture] = useState(null);
    const [usernameChangeCount, setUsernameChangeCount] = useState(0);
    const [originalUsername, setOriginalUsername] = useState('');

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setError,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: yupResolver(schema),
        defaultValues: {
            username: '',
            profile_description: '',
            external_url: '',
        },
    });

    const username = watch('username');
    const profileDescription = watch('profile_description') || '';
    const externalUrl = watch('external_url');
    const canEditUsername = usernameChangeCount < MAX_USERNAME_CHANGES;
    const remainingUsernameChanges = MAX_USERNAME_CHANGES - usernameChangeCount;
    const remainingChars = MAX_DESCRIPTION_LENGTH - profileDescription.length;

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const profile = await getUserProfile();
                const interestsArray = profile.interests
                    ? profile.interests.split(',').map((i) => i.trim()).filter((i) => i)
                    : [];

                reset({
                    username: profile.user.username,
                    profile_description: profile.profile_description || '',
                    external_url: profile.external_url || '',
                });
                setInterests(interestsArray);
                setUsernameChangeCount(profile.username_change_count ?? 0);
                setOriginalUsername(profile.user.username || '');
                setPreviewUrl(profile.profile_picture);
                setLoadError(null);
            } catch (err) {
                setLoadError(t('edit.loadError'));
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [reset, t]);

    const addInterestFromValue = (value) => {
        if (interests.length >= MAX_INTERESTS) return;
        const normalizedValue = value.trim();
        if (!normalizedValue) return;
        const exists = interests.some(
            (tag) => tag.toLowerCase() === normalizedValue.toLowerCase(),
        );
        if (!exists) {
            setInterests((prev) => [...prev, normalizedValue]);
        }
        setInterestInput('');
    };

    const addInterest = () => {
        if (interestInput.trim()) {
            addInterestFromValue(interestInput.trim());
        }
    };

    const removeInterest = (indexToRemove) => {
        setInterests((prev) => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleInterestInputKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addInterest();
        } else if (e.key === 'Backspace' && interestInput === '' && interests.length > 0) {
            removeInterest(interests.length - 1);
        }
    };

    const handleInterestInputChange = (e) => {
        const value = e.target.value;
        if (value.endsWith(',')) {
            const tagValue = value.slice(0, -1).trim();
            if (tagValue) {
                addInterestFromValue(tagValue);
            }
        } else {
            setInterestInput(value);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfilePicture(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const onSubmit = async (data) => {
        setGeneralError(null);

        try {
            const formDataToSend = new FormData();
            formDataToSend.append('profile_description', data.profile_description || '');
            formDataToSend.append('interests', interests.join(', '));
            if (data.external_url) {
                formDataToSend.append('external_url', data.external_url);
            }
            if (profilePicture) {
                formDataToSend.append('profile_picture', profilePicture);
            }

            const usernameChanged = data.username.trim() !== originalUsername;
            if (canEditUsername && usernameChanged && data.username.trim()) {
                formDataToSend.append('username', data.username.trim());
            }

            const response = await updateProfile(formDataToSend);

            // Auth contract: refresh session user if username changed; reuse current access token
            if (usernameChanged && response?.user) {
                const accessToken = getAccessTokenFromLocalStorage();
                if (accessToken) {
                    updateAuthState(response.user, accessToken);
                }
            }

            navigate('/profiles/my_profile');
        } catch (err) {
            const { generalError: parsed } = applyApiErrorsToForm(
                err,
                setError,
                t('edit.updateError'),
            );
            if (parsed) {
                setGeneralError(parsed);
            }
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (loadError) {
        return (
            <Box sx={{ p: 3, maxWidth: 700, mx: 'auto' }}>
                <Alert severity="error">{loadError}</Alert>
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
                        fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
                        fontWeight: 400,
                        fontSize: '24px',
                        mb: 3,
                    }}
                >
                    {t('edit.title')}
                </Typography>

                {generalError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {generalError}
                    </Alert>
                )}

                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                    <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <UserAvatar
                            src={previewUrl}
                            username={username}
                            size={120}
                            sx={{ mb: 2 }}
                        />
                        <Button variant="outlined" component="label">
                            {t('edit.changePhoto')}
                            <input
                                type="file"
                                hidden
                                accept="image/*"
                                onChange={handleImageChange}
                            />
                        </Button>
                    </Box>

                    <TextField
                        label={t('edit.username')}
                        {...bindMuiRhfField(register('username'), username)}
                        fullWidth
                        disabled={!canEditUsername}
                        error={!!errors.username}
                        helperText={
                            errors.username?.message ||
                            (canEditUsername
                                ? t('edit.usernameChanges', { count: remainingUsernameChanges })
                                : t('edit.usernameLocked'))
                        }
                        sx={{ mb: 3 }}
                        autoComplete="username"
                    />

                    <TextField
                        label={t('edit.website')}
                        {...bindMuiRhfField(register('external_url'), externalUrl)}
                        fullWidth
                        placeholder={t('edit.websitePlaceholder')}
                        error={!!errors.external_url}
                        helperText={
                            errors.external_url?.message ||
                            t('edit.websiteHelper')
                        }
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <LinkIcon color="action" />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ mb: 3 }}
                    />

                    <Box>
                        <TextField
                            label={t('edit.interests')}
                            value={interestInput}
                            onChange={handleInterestInputChange}
                            onKeyDown={handleInterestInputKeyDown}
                            fullWidth
                            placeholder={
                                interests.length === 0
                                    ? t('edit.interestPlaceholderEmpty')
                                    : t('edit.interestPlaceholderMore')
                            }
                            helperText={
                                interests.length >= MAX_INTERESTS
                                    ? t('edit.interestsLimit', { max: MAX_INTERESTS })
                                    : t('edit.interestsHelper', {
                                          current: interests.length,
                                          max: MAX_INTERESTS,
                                      })
                            }
                            disabled={interests.length >= MAX_INTERESTS || isSubmitting}
                            InputProps={{
                                startAdornment: (
                                    <>
                                        <InputAdornment position="start">
                                            <InterestsIcon color="action" />
                                        </InputAdornment>
                                        {interests.length > 0 && (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, ml: 1 }}>
                                                {interests.map((interest, index) => (
                                                    <Chip
                                                        key={`${interest}-${index}`}
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
                        {interests.length > 0 && (
                            <FormHelperText sx={{ mt: -1, mb: 2, color: 'text.secondary', fontSize: '0.75rem' }}>
                                {t('edit.interestTip')}
                            </FormHelperText>
                        )}
                    </Box>

                    <TextField
                        label={t('edit.about')}
                        {...(() => {
                            const field = bindMuiRhfField(
                                register('profile_description'),
                                profileDescription,
                            );
                            return {
                                ...field,
                                inputProps: {
                                    ...field.inputProps,
                                    maxLength: MAX_DESCRIPTION_LENGTH,
                                },
                            };
                        })()}
                        multiline
                        rows={5}
                        fullWidth
                        placeholder={t('edit.aboutPlaceholder')}
                        error={!!errors.profile_description}
                        helperText={
                            errors.profile_description?.message || (
                                <Box
                                    component="span"
                                    sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}
                                >
                                    <span>{t('edit.aboutHelper')}</span>
                                    <span
                                        style={{
                                            fontWeight: remainingChars < 50 ? 600 : 400,
                                        }}
                                    >
                                        {t('edit.charsRemaining', { remaining: remainingChars })}
                                    </span>
                                </Box>
                            )
                        }
                        InputProps={{
                            startAdornment: (
                                <InputAdornment
                                    position="start"
                                    sx={{ alignSelf: 'flex-start', mt: 1.5 }}
                                >
                                    <DescriptionIcon color="action" />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ mb: 3 }}
                    />

                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 4 }}>
                        <Button
                            type="button"
                            onClick={() => navigate('/profiles/my_profile')}
                            variant="outlined"
                            disabled={isSubmitting}
                        >
                            {t('edit.cancel')}
                        </Button>
                        <Button type="submit" variant="contained" disabled={isSubmitting}>
                            {isSubmitting ? t('edit.submitting') : t('edit.save')}
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
};

export default EditProfile;
