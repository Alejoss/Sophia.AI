import { useState, useContext } from 'react';
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

const MAX_DEPTH = 3;

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
    const [editedBody, setEditedBody] = useState(comment.body);
    const [isReplying, setIsReplying] = useState(false);
    const [replyBody, setReplyBody] = useState('');
    const [error, setError] = useState(null);
    const [showReplies, setShowReplies] = useState(true);
    const { authState } = useContext(AuthContext);

    const canReply = depth < MAX_DEPTH;
    const isAuthor = authState?.user?.id === comment.author;
    const hasReplies = comment.replies && comment.replies.length > 0;

    const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    const handleReply = async () => {
        if (!authState?.user || !canReply || !replyBody.trim()) {
            return;
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

        // Optimistically update the UI
        setAllComments(prevComments => 
            addReplyToComment(prevComments, comment.id, optimisticReply)
        );
        setIsReplying(false);
        setReplyBody('');

        try {
            const newReply = await commentsApi.addCommentReply(comment.id, replyBody);
            // Update the temporary comment with the real one
            setAllComments(prevComments => 
                updateCommentInTree(prevComments, optimisticReply.id, () => ({
                    ...newReply,
                    replies: []
                }))
            );
        } catch (error) {
            setError('Error al agregar la respuesta. Por favor, inténtelo de nuevo.');
            // Revert the optimistic update
            setAllComments(prevComments => 
                updateCommentInTree(prevComments, comment.id, comment => ({
                    ...comment,
                    replies: comment.replies.filter(r => r.id !== optimisticReply.id),
                    reply_count: comment.reply_count - 1
                }))
            );
        }
    };

    const handleEditComment = async () => {
        if (!editedBody.trim()) return;

        const originalBody = comment.body;
        
        // Optimistically update the UI
        setAllComments(prevComments => 
            updateCommentInTree(prevComments, comment.id, comment => ({
                ...comment,
                body: editedBody,
                is_edited: true
            }))
        );
        setIsEditing(false);

        try {
            await commentsApi.updateComment(comment.id, editedBody);
        } catch (error) {
            setError('Error al editar el comentario. Por favor, inténtelo de nuevo.');
            // Revert the optimistic update
            setAllComments(prevComments => 
                updateCommentInTree(prevComments, comment.id, comment => ({
                    ...comment,
                    body: originalBody,
                    is_edited: comment.is_edited
                }))
            );
        }
    };

    const handleDeleteComment = async () => {
        if (!window.confirm('¿Está seguro de que desea eliminar este comentario?')) {
            return;
        }

        // Optimistically update the UI
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
            // Revert the optimistic update
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
                        <Box sx={{ mt: 1 }}>
                            <TextField
                                fullWidth
                                multiline
                                value={editedBody}
                                onChange={(e) => setEditedBody(e.target.value)}
                                size="small"
                                error={editedBody.trim() === ''}
                                helperText={editedBody.trim() === '' ? 'El comentario no puede estar vacío' : ''}
                            />
                            <Box sx={{ mt: 1 }}>
                                <Button 
                                    size="small" 
                                    onClick={handleEditComment}
                                    disabled={!editedBody.trim() || editedBody === comment.body}
                                >
                                    Guardar
                                </Button>
                                <Button 
                                    size="small" 
                                    onClick={() => {
                                        setIsEditing(false);
                                        setEditedBody(comment.body);
                                    }}
                                >
                                    Cancelar
                                </Button>
                            </Box>
                        </Box>
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
                        <Box sx={{ mt: 2 }}>
                            <TextField
                                fullWidth
                                multiline
                                placeholder="Escriba una respuesta..."
                                value={replyBody}
                                onChange={(e) => setReplyBody(e.target.value)}
                                size="small"
                            />
                            <Box sx={{ mt: 1 }}>
                                <Button 
                                    size="small" 
                                    onClick={handleReply}
                                    disabled={!replyBody.trim()}
                                >
                                    Enviar
                                </Button>
                                <Button size="small" onClick={() => {
                                    setIsReplying(false);
                                    setReplyBody('');
                                }}>
                                    Cancelar
                                </Button>
                            </Box>
                        </Box>
                    )}
                </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center' }}>
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