import { useState, useContext, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { AuthContext } from '../context/AuthContext';
import {
    Box,
    Typography,
    Button,
    TextField,
    Avatar,
    IconButton,
    Menu,
    MenuItem,
    Alert,
    Snackbar,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import commentsApi from '../api/commentsApi';
import VoteComponent from '../votes/VoteComponent';
import BadgeDisplay from '../gamification/BadgeDisplay';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';

const MAX_DEPTH = 3;

const commentBodySchema = yup.object({
    body: yup
        .string()
        .trim()
        .required('El comentario no puede estar vacío'),
});

const EditCommentForm = ({ initialBody, onSave, onCancel }) => {
    const [generalError, setGeneralError] = useState('');
    const {
        register,
        handleSubmit,
        reset,
        setError,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: yupResolver(commentBodySchema),
        defaultValues: { body: initialBody },
    });

    useEffect(() => {
        reset({ body: initialBody });
        setGeneralError('');
    }, [initialBody, reset]);

    const onSubmit = async ({ body }) => {
        setGeneralError('');
        const success = await onSave(body, { setError, setGeneralError });
        if (success) {
            onCancel();
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ mt: 1 }}>
            {generalError && (
                <Alert severity="error" sx={{ mb: 1 }}>
                    {generalError}
                </Alert>
            )}
            <TextField
                fullWidth
                multiline
                size="small"
                error={!!errors.body}
                helperText={errors.body?.message}
                disabled={isSubmitting}
                {...register('body')}
            />
            <Box sx={{ mt: 1 }}>
                <Button
                    type="submit"
                    size="small"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                </Button>
                <Button size="small" onClick={onCancel} disabled={isSubmitting}>
                    Cancelar
                </Button>
            </Box>
        </Box>
    );
};

const ReplyCommentForm = ({ onReply, onCancel }) => {
    const [generalError, setGeneralError] = useState('');
    const {
        register,
        handleSubmit,
        reset,
        setError,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: yupResolver(commentBodySchema),
        defaultValues: { body: '' },
    });

    useEffect(() => {
        reset({ body: '' });
        setGeneralError('');
    }, [reset]);

    const onSubmit = async ({ body }) => {
        setGeneralError('');
        const success = await onReply(body, { setError, setGeneralError });
        if (success) {
            reset({ body: '' });
            onCancel();
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ mt: 2 }}>
            {generalError && (
                <Alert severity="error" sx={{ mb: 1 }}>
                    {generalError}
                </Alert>
            )}
            <TextField
                fullWidth
                multiline
                placeholder="Escriba una respuesta..."
                size="small"
                error={!!errors.body}
                helperText={errors.body?.message}
                disabled={isSubmitting}
                {...register('body')}
            />
            <Box sx={{ mt: 1 }}>
                <Button type="submit" size="small" disabled={isSubmitting}>
                    {isSubmitting ? 'Enviando...' : 'Enviar'}
                </Button>
                <Button size="small" onClick={onCancel} disabled={isSubmitting}>
                    Cancelar
                </Button>
            </Box>
        </Box>
    );
};

// Helper function to find a comment in the nested structure
const findComment = (comments, commentId) => {
    for (const comment of comments) {
        if (comment.id === commentId) {
            return comment;
        }
        if (comment.replies) {
            const found = findComment(comment.replies, commentId);
            if (found) return found;
        }
    }
    return null;
};

// Helper function to update a comment in the nested structure
const updateCommentInTree = (comments, commentId, updateFn) => {
    return comments.map(comment => {
        if (comment.id === commentId) {
            return updateFn(comment);
        }
        if (comment.replies) {
            return {
                ...comment,
                replies: updateCommentInTree(comment.replies, commentId, updateFn)
            };
        }
        return comment;
    });
};

// Helper function to add a reply to a comment in the nested structure
const addReplyToComment = (comments, parentId, newReply) => {
    return comments.map(comment => {
        if (comment.id === parentId) {
            return {
                ...comment,
                replies: [...(comment.replies || []), newReply],
                reply_count: comment.reply_count + 1
            };
        }
        if (comment.replies) {
            return {
                ...comment,
                replies: addReplyToComment(comment.replies, parentId, newReply)
            };
        }
        return comment;
    });
};

export const Comment = ({
    comment,
    depth = 0,
    allComments,
    setAllComments
}) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isReplying, setIsReplying] = useState(false);
    const [error, setError] = useState(null);
    const [showReplies, setShowReplies] = useState(true);
    const { authState } = useContext(AuthContext);

    const canReply = depth < MAX_DEPTH;
    const isAuthor = authState?.user?.id === comment.author;
    const hasReplies = comment.replies && comment.replies.length > 0;

    const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    const handleReply = async (replyBody, { setError: setFormError, setGeneralError }) => {
        if (!authState?.user || !canReply) {
            return false;
        }

        const optimisticReply = {
            id: `temp-${Date.now()}`,
            body: replyBody,
            author: authState.user.id,
            author_name: authState.user.username,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_edited: false,
            replies: [],
            reply_count: 0,
            is_active: true,
            isOptimistic: true
        };

        setAllComments(prevComments =>
            addReplyToComment(prevComments, comment.id, optimisticReply)
        );

        try {
            const newReply = await commentsApi.addCommentReply(comment.id, replyBody);
            setAllComments(prevComments =>
                updateCommentInTree(prevComments, optimisticReply.id, () => ({
                    ...newReply,
                    replies: []
                }))
            );
            return true;
        } catch (err) {
            const { generalError } = applyApiErrorsToForm(
                err,
                setFormError,
                'Error al agregar la respuesta. Por favor, inténtelo de nuevo.',
                { text: 'body', content: 'body' },
            );
            if (generalError) {
                setGeneralError(generalError);
            }
            setAllComments(prevComments =>
                updateCommentInTree(prevComments, comment.id, comment => ({
                    ...comment,
                    replies: comment.replies.filter(r => r.id !== optimisticReply.id),
                    reply_count: comment.reply_count - 1
                }))
            );
            return false;
        }
    };

    const handleEditComment = async (editedBody, { setError: setFormError, setGeneralError }) => {
        if (editedBody === comment.body) {
            return true;
        }

        const originalBody = comment.body;

        setAllComments(prevComments =>
            updateCommentInTree(prevComments, comment.id, comment => ({
                ...comment,
                body: editedBody,
                is_edited: true
            }))
        );

        try {
            await commentsApi.updateComment(comment.id, editedBody);
            return true;
        } catch (err) {
            const { generalError } = applyApiErrorsToForm(
                err,
                setFormError,
                'Error al editar el comentario. Por favor, inténtelo de nuevo.',
                { text: 'body', content: 'body' },
            );
            if (generalError) {
                setGeneralError(generalError);
            }
            setAllComments(prevComments =>
                updateCommentInTree(prevComments, comment.id, comment => ({
                    ...comment,
                    body: originalBody,
                    is_edited: comment.is_edited
                }))
            );
            return false;
        }
    };

    const handleDeleteComment = async () => {
        if (!window.confirm('¿Está seguro de que desea eliminar este comentario?')) {
            return;
        }

        setAllComments(prevComments =>
            updateCommentInTree(prevComments, comment.id, comment => ({
                ...comment,
                is_active: false
            }))
        );

        try {
            await commentsApi.deleteComment(comment.id);
        } catch (error) {
            setError('Error al eliminar el comentario. Por favor, inténtelo de nuevo.');
            setAllComments(prevComments =>
                updateCommentInTree(prevComments, comment.id, comment => ({
                    ...comment,
                    is_active: true
                }))
            );
        }
    };

    if (!comment.is_active) {
        return null;
    }

    return (
        <Box sx={{ ml: depth * 4, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Avatar>{comment.author_name?.[0]?.toUpperCase() || '?'}</Avatar>
                <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="subtitle2">{comment.author_name}</Typography>
                            {comment.featured_badge && (
                                <BadgeDisplay
                                    badge={comment.featured_badge}
                                    showName={false}
                                    context="comment"
                                />
                            )}
                        </Box>
                        {isAuthor && (
                            <>
                                <IconButton size="small" onClick={handleMenuOpen}>
                                    <MoreVertIcon />
                                </IconButton>
                                <Menu
                                    anchorEl={anchorEl}
                                    open={Boolean(anchorEl)}
                                    onClose={handleMenuClose}
                                >
                                    <MenuItem onClick={() => {
                                        setIsEditing(true);
                                        handleMenuClose();
                                    }}>
                                        Editar
                                    </MenuItem>
                                    <MenuItem onClick={() => {
                                        handleDeleteComment();
                                        handleMenuClose();
                                    }}>
                                        Eliminar
                                    </MenuItem>
                                </Menu>
                            </>
                        )}
                    </Box>

                    {isEditing ? (
                        <EditCommentForm
                            initialBody={comment.body}
                            onSave={handleEditComment}
                            onCancel={() => setIsEditing(false)}
                        />
                    ) : (
                        <Typography variant="body2">{comment.body}</Typography>
                    )}

                    <Box sx={{ mt: 1, display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                            hace {formatDistanceToNow(new Date(comment.created_at), { locale: es })}
                            {comment.is_edited && ' (editado)'}
                        </Typography>
                        {canReply && authState?.isAuthenticated && (
                            <Button size="small" onClick={() => setIsReplying(!isReplying)}>
                                Responder
                            </Button>
                        )}
                        {hasReplies && (
                            <Button
                                size="small"
                                onClick={() => setShowReplies(!showReplies)}
                                sx={{ ml: 'auto' }}
                            >
                                {showReplies ? 'Ocultar Respuestas' : `Mostrar ${comment.replies.length} ${comment.replies.length === 1 ? 'Respuesta' : 'Respuestas'}`}
                            </Button>
                        )}
                    </Box>

                    {isReplying && (
                        <ReplyCommentForm
                            onReply={handleReply}
                            onCancel={() => setIsReplying(false)}
                        />
                    )}
                </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 0.5 }}>
                <VoteComponent
                    type="comment"
                    ids={{ commentId: comment.id }}
                    initialVoteCount={comment.vote_count}
                    initialUserVote={comment.user_vote}
                />
            </Box>

            {hasReplies && showReplies && (
                <Box sx={{ mt: 2 }}>
                    {comment.replies.map(reply => (
                        <Comment
                            key={reply.id}
                            comment={reply}
                            depth={depth + 1}
                            allComments={allComments}
                            setAllComments={setAllComments}
                        />
                    ))}
                </Box>
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
        </Box>
    );
};
