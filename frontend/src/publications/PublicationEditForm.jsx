import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
    CircularProgress,
    Link,
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
        .required(() => i18n.t('publications:editForm.textRequired')),
});

const PublicationEditForm = () => {
    const { t } = useTranslation('publications');
    const navigate = useNavigate();
    const { publicationId } = useParams();
    const [selectedContent, setSelectedContent] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [submitError, setSubmitError] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [isFetching, setIsFetching] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUploadingContent, setIsUploadingContent] = useState(false);
    const [hasPendingContent, setHasPendingContent] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        setError,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: yupResolver(schema),
        defaultValues: { text_content: '' },
    });

    useEffect(() => {
        const fetchPublicationDetails = async () => {
            try {
                setIsFetching(true);
                const publicationData = await contentApi.getPublicationDetails(publicationId);

                reset({
                    text_content: publicationData.text_content || '',
                });

                if (publicationData.content) {
                    setSelectedContent(publicationData.content);
                }

                setLoadError('');
            } catch (err) {
                console.error('Error fetching publication details:', err);
                setLoadError(t('editForm.loadError'));
            } finally {
                setIsFetching(false);
            }
        };

        fetchPublicationDetails();
    }, [publicationId, reset, t]);

    const handleContentSelected = (contentProfile) => {
        setSelectedContent(contentProfile);
    };

    const handleContentRemoved = () => {
        setSelectedContent(null);
    };

    const onSubmit = async ({ text_content }) => {
        setSubmitError('');
        setDeleteError('');

        try {
            const contentProfileId =
                selectedContent?.profile_id || selectedContent?.id || null;

            const publicationData = {
                text_content,
                status: 'PUBLISHED',
                content_profile_id: contentProfileId,
            };

            await contentApi.updatePublication(publicationId, publicationData);
            navigate('/profiles/my_profile');
        } catch (err) {
            console.error('Error updating publication:', err);
            const { generalError: parsed } = applyApiErrorsToForm(
                err,
                setError,
                t('editForm.updateError'),
                { text_content: 'text_content' },
            );
            if (parsed) {
                setSubmitError(parsed);
            }
        }
    };

    const handleCancel = () => {
        navigate('/profiles/my_profile');
    };

    const handleDelete = async () => {
        if (
            window.confirm(
                t('editForm.deleteConfirm'),
            )
        ) {
            setDeleteError('');
            setSubmitError('');

            try {
                setIsDeleting(true);
                await contentApi.deletePublication(publicationId);
                navigate('/profiles/my_profile');
            } catch (err) {
                console.error('Error deleting publication:', err);
                setDeleteError(t('editForm.deleteError'));
            } finally {
                setIsDeleting(false);
            }
        }
    };

    if (isFetching) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (loadError) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">{loadError}</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 3 }}>
                <Link
                    component="button"
                    variant="body2"
                    onClick={() => navigate('/profiles/my_profile')}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                    {t('editForm.back')}
                </Link>
            </Box>

            <Typography variant="h4" gutterBottom>
                {t('editForm.title')}
            </Typography>

            <ContentSelector
                selectedContent={selectedContent}
                onContentSelected={handleContentSelected}
                onContentRemoved={handleContentRemoved}
                previewVariant="preview"
                onUploadingChange={setIsUploadingContent}
                onPendingContentChange={setHasPendingContent}
            />

            <Paper elevation={2} sx={{ p: 4 }}>
                <Typography variant="h6" gutterBottom>
                    {t('editForm.details')}
                </Typography>

                {(submitError || deleteError) && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {submitError || deleteError}
                    </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                    <TextField
                        fullWidth
                        multiline
                        minRows={5}
                        maxRows={24}
                        label={t('editForm.textLabel')}
                        {...register('text_content')}
                        error={!!errors.text_content}
                        helperText={errors.text_content?.message}
                        required
                        sx={{ mb: 3 }}
                    />

                    <Divider sx={{ my: 3 }} />

                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        <Button
                            variant="outlined"
                            color="error"
                            type="button"
                            onClick={handleDelete}
                            disabled={isSubmitting || isDeleting || isUploadingContent}
                        >
                            {isDeleting ? t('editForm.deleting') : t('editForm.delete')}
                        </Button>
                        <Button
                            variant="outlined"
                            type="button"
                            onClick={handleCancel}
                            disabled={isSubmitting || isDeleting || isUploadingContent}
                        >
                            {t('editForm.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={isSubmitting || isDeleting || isUploadingContent || hasPendingContent}
                        >
                            {isSubmitting ? t('editForm.updating') : t('editForm.submit')}
                        </Button>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default PublicationEditForm;
