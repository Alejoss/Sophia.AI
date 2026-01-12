import React, { useState, useEffect, useContext } from 'react';
import {
    Box,
    Typography,
    TextField,
    Button,
    Paper,
    Divider,
    Alert,
    Snackbar
} from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import commentsApi from '../api/commentsApi';
import { Comment } from './Comment';

const CommentSection = ({ topicId = null, contentId = null, knowledgePathId = null }) => {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { authState } = useContext(AuthContext);

    useEffect(() => {
        loadComments();
    }, [topicId, contentId, knowledgePathId]);

    const loadComments = async () => {
        try {
            setLoading(true);
            let fetchedComments;
            
            if (knowledgePathId) {
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

    const handleAddComment = async () => {
        if (!authState.user) {
            setError('Debe iniciar sesión para comentar');
            return;
        }

        if (!newComment.trim()) {
            return;
        }

        try {
            if (knowledgePathId) {
                await commentsApi.addKnowledgePathComment(knowledgePathId, newComment);
            } else if (contentId) {
                await commentsApi.addContentComment(topicId, contentId, newComment);
            } else if (topicId) {
                await commentsApi.addTopicComment(topicId, newComment);
            }

            setNewComment('');
            await loadComments();
        } catch (error) {
            setError('Error al agregar el comentario. Por favor, inténtelo de nuevo.');
        }
    };

    const handleDeleteComment = async (commentId) => {
        try {
            await commentsApi.deleteComment(commentId);
            await loadComments();
        } catch (err) {
            setError('Error al eliminar el comentario');
        }
    };

    const handleUpdateComment = async (commentId, body) => {
        try {
            await commentsApi.updateComment(commentId, body);
            await loadComments();
        } catch (error) {
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
        } catch (error) {
            setError('Error al agregar la respuesta. Por favor, inténtelo de nuevo.');
        }
    };

    if (loading) return <Typography>Cargando comentarios...</Typography>;

    return (
        <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
                Comentarios
            </Typography>
            
            {authState.isAuthenticated ? (
                <Box sx={{ mb: 3 }}>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        placeholder="Escriba un comentario..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                    />
                    <Button
                        variant="contained"
                        sx={{ mt: 1 }}
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                    >
                        Publicar Comentario
                    </Button>
                </Box>
            ) : (
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                    Por favor, inicie sesión para dejar un comentario.
                </Typography>
            )}

            <Divider sx={{ my: 2 }} />

            {comments.length > 0 ? (
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
                <Typography color="text.secondary">
                    Aún no hay comentarios. ¡Sé el primero en comentar!
                </Typography>
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