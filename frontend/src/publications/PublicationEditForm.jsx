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
import contentApi from '../api/contentApi';
import ContentSelector from '../content/ContentSelector';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';

const schema = yup.object({
    text_content: yup
        .string()
        .trim()
        .required('El contenido de texto es requerido.'),
});

const PublicationEditForm = () => {
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
                setLoadError('Error al cargar los detalles de la publicación');
            } finally {
                setIsFetching(false);
            }
        };

        fetchPublicationDetails();
    }, [publicationId, reset]);

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
                'Error al actualizar la publicación.',
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
                '¿Está seguro de que desea eliminar esta publicación? Esta acción no se puede deshacer.',
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
                setDeleteError('Error al eliminar la publicación');
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
                    ← Volver al Perfil
                </Link>
            </Box>

            <Typography variant="h4" gutterBottom>
                Editar Publicación
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
                    Detalles de la Publicación
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
                        label="Contenido de Texto"
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
                            {isDeleting ? 'Eliminando...' : 'Eliminar'}
                        </Button>
                        <Button
                            variant="outlined"
                            type="button"
                            onClick={handleCancel}
                            disabled={isSubmitting || isDeleting || isUploadingContent}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={isSubmitting || isDeleting || isUploadingContent || hasPendingContent}
                        >
                            {isSubmitting ? 'Actualizando...' : 'Actualizar Publicación'}
                        </Button>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default PublicationEditForm;
