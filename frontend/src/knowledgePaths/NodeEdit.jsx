import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
    Paper,
} from '@mui/material';
import QuizIcon from '@mui/icons-material/Quiz';
import knowledgePathsApi from '../api/knowledgePathsApi';
import quizzesApi from '../api/quizzesApi';
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

const NodeEdit = () => {
    const { pathId, nodeId } = useParams();
    const navigate = useNavigate();
    const [knowledgePath, setKnowledgePath] = useState(null);
    const [selectedContent, setSelectedContent] = useState(null);
    const [nodeQuiz, setNodeQuiz] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [submitError, setSubmitError] = useState('');
    const [loading, setLoading] = useState(true);
    const [hasPendingContent, setHasPendingContent] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        getValues,
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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [pathData, nodeData] = await Promise.all([
                    knowledgePathsApi.getKnowledgePathBasic(pathId),
                    knowledgePathsApi.getNode(pathId, nodeId),
                ]);

                setKnowledgePath(pathData);

                const hasContentProfile =
                    nodeData.content_profile_id !== null &&
                    nodeData.content_profile_id !== undefined;

                reset({
                    title: nodeData.title,
                    description: nodeData.description || '',
                    content_profile_id: hasContentProfile ? nodeData.content_profile_id : null,
                });

                if (hasContentProfile) {
                    try {
                        const contentProfileData = await knowledgePathsApi.getNodeContent(
                            nodeData.content_profile_id,
                        );
                        setSelectedContent(contentProfileData);
                    } catch (contentErr) {
                        console.error('Error fetching content profile:', contentErr);
                        setSelectedContent(null);
                    }
                }

                try {
                    const quizzesData = await quizzesApi.getQuizzesByPathId(pathId);
                    const quizForNode = Array.isArray(quizzesData)
                        ? quizzesData.find((quiz) => quiz.node === parseInt(nodeId, 10))
                        : null;
                    setNodeQuiz(quizForNode || null);
                } catch (quizErr) {
                    console.error('Error fetching quiz:', quizErr);
                    setNodeQuiz(null);
                }
            } catch (err) {
                console.error('Failed to load data:', err);
                setLoadError('Error al cargar los datos');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [pathId, nodeId, reset]);

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

    const onSubmit = async (formData) => {
        setSubmitError('');

        try {
            await knowledgePathsApi.updateNode(pathId, nodeId, formData);
            navigate(`/knowledge_path/${pathId}/edit`);
        } catch (err) {
            console.error('Error updating node:', err);
            const { generalError: parsed } = applyApiErrorsToForm(
                err,
                setError,
                'Error al actualizar el nodo.',
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
                    Editar Nodo de Contenido
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    en el Camino de Conocimiento: {knowledgePath?.title}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <ContentSelector
                        selectedContent={selectedContent}
                        onContentSelected={handleContentSelected}
                        onContentRemoved={handleContentRemoved}
                        previewVariant="detailed"
                        onPendingContentChange={setHasPendingContent}
                        optional={false}
                    />

                    {nodeQuiz && (
                        <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <QuizIcon color="secondary" />
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                        {nodeQuiz.title || 'Cuestionario'}
                                    </Typography>
                                </Stack>
                                <Button
                                    component={Link}
                                    to={`/quizzes/${nodeQuiz.id}/edit`}
                                    variant="outlined"
                                    color="secondary"
                                    sx={{ textTransform: 'none' }}
                                >
                                    Editar cuestionario
                                </Button>
                            </Stack>
                        </Paper>
                    )}

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

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            <Button
                                type="submit"
                                variant="contained"
                                color="success"
                                disabled={isSubmitting || hasPendingContent}
                                sx={{ minWidth: { xs: '100%', md: 'auto' } }}
                            >
                                {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                            </Button>
                            <Button
                                type="button"
                                onClick={() => navigate(`/knowledge_path/${pathId}/edit`)}
                                variant="outlined"
                                color="inherit"
                                disabled={isSubmitting}
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

export default NodeEdit;
