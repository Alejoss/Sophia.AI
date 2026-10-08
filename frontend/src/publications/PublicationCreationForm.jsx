import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
    TextField,
    Button,
    Box,
    Typography,
    Paper,
    Divider,
    Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';
import ContentSelector from '../content/ContentSelector';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';
import i18n from '../i18n';

const schema = yup.object({
    text_content: yup
        .string()
        .trim()
        .required(() => i18n.t('publications:create.textRequired')),
});

const PublicationCreationForm = () => {
    const { t } = useTranslation('publications');
    const navigate = useNavigate();
    const [selectedContent, setSelectedContent] = useState(null);
    const [generalError, setGeneralError] = useState('');
    const [isUploadingContent, setIsUploadingContent] = useState(false);
    const [hasPendingContent, setHasPendingContent] = useState(false);

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: yupResolver(schema),
        defaultValues: { text_content: '' },
    });

    const handleContentSelected = (contentProfile) => {
        setSelectedContent(contentProfile);
    };

    const handleContentRemoved = () => {
        setSelectedContent(null);
    };

    const onSubmit = async ({ text_content }) => {
        setGeneralError('');

        try {
            const publicationData = {
                text_content,
                status: 'PUBLISHED',
                content_profile_id: selectedContent?.id || null,
            };

            await contentApi.createPublication(publicationData);
            navigate('/profiles/my_profile');
        } catch (err) {
            console.error('Error creating publication:', err);
            const { generalError: parsed } = applyApiErrorsToForm(
                err,
                setError,
                t('create.error'),
                { text_content: 'text_content' },
            );
            if (parsed) {
                setGeneralError(parsed);
            }
        }
    };

    const handleCancel = () => {
        navigate('/profiles/my_profile');
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography
                variant="h4"
                color="#000"
                gutterBottom
                sx={{
                    fontSize: {
                        xs: '1.5rem',
                        sm: '1.75rem',
                        md: '2.125rem',
                    },
                    fontWeight: 600,
                }}
            >
                {t('create.title')}
            </Typography>

            <ContentSelector
                selectedContent={selectedContent}
                onContentSelected={handleContentSelected}
                onContentRemoved={handleContentRemoved}
                previewVariant="detailed"
                onUploadingChange={setIsUploadingContent}
                onPendingContentChange={setHasPendingContent}
            />

            <Paper elevation={2} sx={{ p: 4 }}>
                <Typography variant="h6" gutterBottom>
                    {t('create.details')}
                </Typography>

                {generalError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {generalError}
                    </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                    <TextField
                        fullWidth
                        multiline
                        minRows={5}
                        maxRows={24}
                        label={t('create.textLabel')}
                        {...register('text_content')}
                        error={!!errors.text_content}
                        helperText={errors.text_content?.message}
                        required
                        sx={{ mb: 3 }}
                    />

                    <Divider sx={{ my: 3 }} />

                    <Box
                        sx={{
                            display: {
                                xs: 'block',
                                md: 'flex',
                            },
                            gap: 2,
                            justifyContent: 'flex-end',
                        }}
                    >
                        <Button
                            sx={{
                                mb: {
                                    xs: 1.25,
                                    md: 0,
                                },
                            }}
                            variant="outlined"
                            type="button"
                            onClick={handleCancel}
                            disabled={isSubmitting || isUploadingContent}
                        >
                            {t('create.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={isSubmitting || isUploadingContent || hasPendingContent}
                        >
                            {isSubmitting ? t('create.creating') : t('create.submit')}
                        </Button>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default PublicationCreationForm;
