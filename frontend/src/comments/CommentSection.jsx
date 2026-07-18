import React, { useState, useEffect, useContext } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
    Box,
    Typography,
    TextField,
    Button,
    Paper,
    Divider,
    Alert,
    Snackbar,
    CircularProgress,
} from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import commentsApi from '../api/commentsApi';
import { Comment } from './Comment';
import { applyApiErrorsToForm } from '../utils/apiFormErrors.js';

const commentSchema = yup.object({
    body: yup
        .string()
        .trim()
        .required('Escribe un comentario antes de publicar.'),
});

const CommentSection = ({
    topicId = null,
    contentId = null,
    knowledgePathId = null,
    discussionQuestionId = null,
    readOnly = false,
    hideComments = false,
    hideForm = false,
    hideFormNotice = null,
    onAfterMutate = null,
    title = 'Comentarios',
    placeholder = 'Escriba un comentario...',
    submitLabel = 'Publicar Comentario',
    emptyLabel = 'No hay comentarios todavía.',
    lockedEmptyLabel = null,
}) => {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [generalError, setGeneralError] = useState('');
    const { authState } = useContext(AuthContext);

    const {
        register,
        handleSubmit,
        reset,
        setError: setFormError,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: yupResolver(commentSchema),
        defaultValues: { body: '' },
    });

    useEffect(() => {
        if (hideComments) {
            setComments([]);
            setLoading(false);
            return;
        }
        loadComments();
    }, [topicId, contentId, knowledgePathId, discussionQuestionId, hideComments]);

    const loadComments = async () => {
        try {
            setLoading(true);
            let fetchedComments;

            if (discussionQuestionId) {
                fetchedComments = await commentsApi.getDiscussionQuestionComments(discussionQuestionId);
            } else if (knowledgePathId) {
                fetchedComments = await commentsApi.getKnowledgePathComments(knowledgePathId);
            } else if (contentId) {
                fetchedComments = await commentsApi.getContentComments(topicId, contentId);
            } else if (topicId) {
                fetchedComments = await commentsApi.getTopicComments(topicId);
            } else {
                throw new Error('No valid comment context provided');
            }

            setComments(fetchedComments);
        } catch (err) {
            if (err.response?.status !== 404) {
                setError('Error al cargar los comentarios');
            }
            setComments([]);
        } finally {
            setLoading(false);
        }
    };

    const notifyMutate = async () => {
        if (typeof onAfterMutate === 'function') {
            await onAfterMutate();
        }
    };

    const onSubmit = async ({ body }) => {
        if (!authState.user) {
            setError('Debe iniciar sesión para comentar');
            return;
        }

        setGeneralError('');

        try {
            if (discussionQuestionId) {
                await commentsApi.addDiscussionQuestionComment(discussionQuestionId, body);
            } else if (knowledgePathId) {
                await commentsApi.addKnowledgePathComment(knowledgePathId, body);
            } else if (contentId) {
                await commentsApi.addContentComment(topicId, contentId, body);
            } else if (topicId) {
                await commentsApi.addTopicComment(topicId, body);
            }

            reset({ body: '' });
            await notifyMutate();
            if (!hideComments) {
                await loadComments();
            }
        } catch (err) {
            const { generalError: parsed } = applyApiErrorsToForm(
                err,
                setFormError,
                'Error al agregar el comentario. Por favor, inténtelo de nuevo.',
                { text: 'body', content: 'body' },
            );
            if (parsed) {
                setGeneralError(parsed);
            }
        }
    };

    const handleDeleteComment = async (commentId) => {
        try {
            await commentsApi.deleteComment(commentId);
            await notifyMutate();
            await loadComments();
        } catch {
            setError('Error al eliminar el comentario');
        }
    };

    const handleUpdateComment = async (commentId, body) => {
        try {
            await commentsApi.updateComment(commentId, body);
            await loadComments();
        } catch {
            setError('Error al actualizar el comentario');
        }
    };

    const handleReplySubmit = async (parentId, body) => {
        if (!authState.user) {
            setError('Debe iniciar sesión para responder');
            return;
        }

        try {
            await commentsApi.addCommentReply(parentId, body);
            await loadComments();
        } catch {
            setError('Error al agregar la respuesta. Por favor, inténtelo de nuevo.');
        }
    };

    if (loading && !hideComments) return <Typography>Cargando comentarios...</Typography>;

    return (
        <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
                {title}
            </Typography>

            {authState.isAuthenticated && !readOnly && hideForm ? (
                hideFormNotice ? (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        {hideFormNotice}
                    </Alert>
                ) : null
            ) : authState.isAuthenticated && !readOnly ? (
                <Box
                    component="form"
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    sx={{ mb: 3 }}
                >
                    {generalError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {generalError}
                        </Alert>
                    )}
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        placeholder={placeholder}
                        error={!!errors.body}
                        helperText={errors.body?.message}
                        disabled={isSubmitting}
                        {...register('body')}
                    />
                    <Button
                        type="submit"
                        variant="contained"
                        sx={{ mt: 1 }}
                        disabled={isSubmitting}
                        startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : null}
                    >
                        {isSubmitting ? 'Publicando...' : submitLabel}
                    </Button>
                </Box>
            ) : readOnly ? (
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                    Esta conversación está cerrada.
                    {hideComments
                        ? ' Publica tu respuesta cuando esté abierta para ver las de los demás.'
                        : ' Puedes leer las respuestas.'}
                </Typography>
            ) : (
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                    Por favor, inicie sesión para dejar un comentario.
                </Typography>
            )}

            <Divider sx={{ my: 2 }} />

            {hideComments ? (
                <Typography color="text.secondary">
                    {lockedEmptyLabel ||
                        'Publica tu respuesta para ver las de los demás miembros.'}
                </Typography>
            ) : comments.length > 0 ? (
                <Box>
                    {comments.map(comment => (
                        <Comment
                            key={comment.id}
                            comment={comment}
                            depth={0}
                            allComments={comments}
                            setAllComments={setComments}
                            onReplySubmit={handleReplySubmit}
                            onEditComment={handleUpdateComment}
                            onDeleteComment={handleDeleteComment}
                        />
                    ))}
                </Box>
            ) : (
                <Typography color="text.secondary">{emptyLabel}</Typography>
            )}

            <Snackbar
                open={!!error}
                autoHideDuration={6000}
                onClose={() => setError(null)}
            >
                <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                </Alert>
            </Snackbar>
        </Paper>
    );
};

export default CommentSection;
