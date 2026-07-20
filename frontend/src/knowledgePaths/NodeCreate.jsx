import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
    Container,
    Box,
    Typography,
    TextField,
    Button,
    Alert,
    CircularProgress,
    Stack,
} from '@mui/material';
import knowledgePathsApi from '../api/knowledgePathsApi';
import ContentSelector from '../content/ContentSelector';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';

const schema = yup.object({
    title: yup
        .string()
        .trim()
        .required('El título es requerido.'),
    description: yup.string().trim().default(''),
    content_profile_id: yup
        .mixed()
        .nullable()
        .test(
            'required',
            'Debes seleccionar un contenido.',
            (value) => value != null && value !== '',
        ),
});

const NodeCreate = () => {
    const { pathId } = useParams();
    const navigate = useNavigate();
    const [knowledgePath, setKnowledgePath] = useState(null);
    const [selectedContent, setSelectedContent] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [submitError, setSubmitError] = useState('');
    const [loading, setLoading] = useState(true);
    const [isUploadingContent, setIsUploadingContent] = useState(false);
    const [hasPendingContent, setHasPendingContent] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        getValues,
        watch,
        setError,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: yupResolver(schema),
        defaultValues: {
            title: '',
            description: '',
            content_profile_id: null,
        },
    });

    const contentProfileId = watch('content_profile_id');

    useEffect(() => {
        const fetchKnowledgePath = async () => {
            try {
                const data = await knowledgePathsApi.getKnowledgePathBasic(pathId);
                setKnowledgePath(data);
            } catch (err) {
                console.error('Error loading knowledge path:', err);
                setLoadError('Error al cargar el camino de conocimiento');
            } finally {
                setLoading(false);
            }
        };

        fetchKnowledgePath();
    }, [pathId]);

    const handleContentSelected = useCallback(
        (contentProfile) => {
            setSelectedContent(contentProfile);
            setValue('content_profile_id', contentProfile.id, { shouldValidate: true });

            if (!getValues('title')?.trim()) {
                const defaultTitle =
                    contentProfile.title ||
                    contentProfile.content?.original_title ||
                    'Untitled';
                setValue('title', defaultTitle);
            }
        },
        [setValue, getValues],
    );

    const handleContentRemoved = useCallback(() => {
        setSelectedContent(null);
        setValue('content_profile_id', null, { shouldValidate: true });
    }, [setValue]);

    const handleUploadingChange = useCallback((uploading) => {
        setIsUploadingContent(uploading);
    }, []);

    const onSubmit = async (formData) => {
        setSubmitError('');

        try {
            await knowledgePathsApi.addNode(pathId, formData);
            navigate(`/knowledge_path/${pathId}/edit`);
        } catch (err) {
            console.error('Error adding node:', err);
            const { generalError: parsed } = applyApiErrorsToForm(
                err,
                setError,
                'Error al agregar el nodo.',
                {
                    title: 'title',
                    description: 'description',
                    content_profile_id: 'content_profile_id',
                },
            );
            if (parsed) {
                setSubmitError(parsed);
            }
        }
    };

    if (loading) {
        return (
            <Container sx={{ py: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    if (loadError) {
        return (
            <Container sx={{ py: 4 }}>
                <Alert severity="error">{loadError}</Alert>
            </Container>
        );
    }

    return (
        <Container sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, md: 3 } }}>
            <Box sx={{ maxWidth: '800px', mx: 'auto' }}>
                <Typography variant="h5" component="h1" sx={{ mb: 1 }}>
                    Agregar Nodo de Contenido
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    al Camino de Conocimiento: {knowledgePath?.title}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <ContentSelector
                        selectedContent={selectedContent}
                        onContentSelected={handleContentSelected}
                        onContentRemoved={handleContentRemoved}
                        previewVariant="detailed"
                        onUploadingChange={handleUploadingChange}
                        onPendingContentChange={setHasPendingContent}
                        optional={false}
                    />

                    {errors.content_profile_id && (
                        <Alert severity="error">{errors.content_profile_id.message}</Alert>
                    )}

                    {submitError && (
                        <Alert severity="error">{submitError}</Alert>
                    )}

                    <Box
                        component="form"
                        onSubmit={handleSubmit(onSubmit)}
                        noValidate
                        sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
                    >
                        <TextField
                            fullWidth
                            id="title"
                            label="Título del Nodo"
                            {...register('title')}
                            error={!!errors.title}
                            helperText={errors.title?.message}
                            required
                        />

                        <TextField
                            fullWidth
                            id="description"
                            label="Descripción"
                            {...register('description')}
                            error={!!errors.description}
                            helperText={errors.description?.message}
                            multiline
                            minRows={5}
                            maxRows={24}
                        />

                        {isUploadingContent && (
                            <Alert severity="info" sx={{ mb: 1 }}>
                                Subiendo contenido… Completa el título y la descripción del nodo mientras tanto.
                            </Alert>
                        )}

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            <Button
                                type="submit"
                                variant="contained"
                                color="primary"
                                disabled={
                                    !contentProfileId ||
                                    isSubmitting ||
                                    isUploadingContent ||
                                    hasPendingContent
                                }
                                sx={{ minWidth: { xs: '100%', md: 'auto' } }}
                            >
                                {isSubmitting ? 'Agregando...' : 'Agregar Nodo'}
                            </Button>
                            <Button
                                type="button"
                                onClick={() => navigate(`/knowledge_path/${pathId}/edit`)}
                                variant="outlined"
                                color="inherit"
                                sx={{ minWidth: { xs: '100%', md: 'auto' } }}
                            >
                                Cancelar
                            </Button>
                        </Stack>
                    </Box>
                </Box>
            </Box>
        </Container>
    );
};

export default NodeCreate;
