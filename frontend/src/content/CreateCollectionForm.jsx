import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Paper, FormControlLabel, Switch, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';
import i18n from '../i18n';

const schema = yup.object().shape({
    name: yup
        .string()
        .required(() => i18n.t('content:collectionForm.nameRequired'))
        .min(3, () => i18n.t('content:collectionForm.nameMin'))
        .max(100, () => i18n.t('content:collectionForm.nameMax')),
    description: yup
        .string()
        .max(300, () => i18n.t('content:collectionForm.descriptionMax'))
        .default(''),
    is_public: yup.boolean().default(false),
});

const CreateCollectionForm = () => {
    const { t } = useTranslation('content');
    const [generalError, setGeneralError] = useState('');
    const navigate = useNavigate();
    const {
        register,
        handleSubmit,
        control,
        setError,
        watch,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: yupResolver(schema),
        defaultValues: { name: '', description: '', is_public: false },
    });

    const descriptionValue = watch('description') || '';

    const onSubmit = async (data) => {
        setGeneralError('');
        try {
            await contentApi.createCollection({
                name: data.name,
                description: (data.description || '').trim(),
                is_public: !!data.is_public,
            });
            navigate('/content/collections');
        } catch (error) {
            console.error('Failed to create collection:', error);
            const { generalError: parsed } = applyApiErrorsToForm(
                error,
                setError,
                t('collectionForm.createError'),
            );
            if (parsed) {
                setGeneralError(parsed);
            }
        }
    };

    return (
        <Box sx={{ pt: 12, px: 3, maxWidth: 600, mx: 'auto' }}>
            <Paper sx={{ p: 3 }}>
                <Typography variant="h4" gutterBottom>
                    {t('collectionForm.title')}
                </Typography>

                {generalError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {generalError}
                    </Alert>
                )}

                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                    <TextField
                        fullWidth
                        label={t('collectionForm.name')}
                        {...register('name')}
                        error={!!errors.name}
                        helperText={errors.name?.message}
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        fullWidth
                        label={t('collectionForm.shortDescription')}
                        multiline
                        minRows={2}
                        maxRows={4}
                        {...register('description')}
                        error={!!errors.description}
                        helperText={
                            errors.description?.message ||
                            t('collectionForm.charCount', { value: descriptionValue.length })
                        }
                        inputProps={{ maxLength: 300 }}
                        sx={{ mb: 2 }}
                    />

                    <Controller
                        name="is_public"
                        control={control}
                        render={({ field }) => (
                            <FormControlLabel
                                sx={{ mb: 2, display: 'flex', alignItems: 'flex-start' }}
                                control={
                                    <Switch
                                        checked={!!field.value}
                                        onChange={(_, v) => field.onChange(v)}
                                        color="primary"
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography variant="body2" component="span" display="block">
                                            {t('collectionForm.public')}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            {t('collectionForm.publicHelp')}
                                        </Typography>
                                    </Box>
                                }
                            />
                        )}
                    />

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            type="button"
                            variant="outlined"
                            onClick={() => navigate('/content/collections')}
                            disabled={isSubmitting}
                        >
                            {t('actions.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? t('collectionForm.creating') : t('collectionForm.submit')}
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
};

export default CreateCollectionForm;
