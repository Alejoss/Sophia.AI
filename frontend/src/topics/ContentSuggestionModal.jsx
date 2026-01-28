import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    Alert,
    CircularProgress
} from '@mui/material';
import LibrarySelectMultiple from '../content/LibrarySelectMultiple';
import contentApi from '../api/contentApi';

const ContentSuggestionModal = ({ open, onClose, topicId, onSuccess }) => {
    const [selectedContentProfiles, setSelectedContentProfiles] = useState([]);
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [showContentSelect, setShowContentSelect] = useState(true);

    const handleContentSelection = (selectedProfiles) => {
        setSelectedContentProfiles(selectedProfiles);
    };

    const handleCancelContentSelect = () => {
        setShowContentSelect(false);
        onClose();
    };

    const handleSaveContentSelect = (selectedIds) => {
        // selectedIds are content profile IDs, but we need to keep the full objects
        // The onSelectionChange callback provides the full objects
        setShowContentSelect(false);
    };

    const handleSubmit = async () => {
        if (selectedContentProfiles.length === 0) {
            setError('Debe seleccionar al menos un contenido para sugerir');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            // Submit all selected content items
            // Extract content.content.id (base content ID) from each profile
            const promises = selectedContentProfiles.map(profile => {
                const contentId = profile.content?.id;
                if (!contentId) {
                    throw new Error(`Contenido sin ID válido para el perfil ${profile.id}`);
                }
                return contentApi.createContentSuggestion(topicId, contentId, message.trim());
            });
            
            await Promise.all(promises);
            
            // Clear form
            setSelectedContentProfiles([]);
            setMessage('');
            setShowContentSelect(true);
            
            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (err) {
            setError(
                err.response?.data?.error || 
                err.response?.data?.message || 
                err.message ||
                'Error al crear la sugerencia. Por favor, inténtelo de nuevo.'
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!submitting) {
            setSelectedContentProfiles([]);
            setMessage('');
            setError(null);
            setShowContentSelect(true);
            onClose();
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            disableEscapeKeyDown={submitting}
        >
            <DialogContent sx={{ pt: 3 }}>
                {showContentSelect ? (
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Selecciona el contenido que deseas sugerir para este tema.
                        </Typography>
                        <LibrarySelectMultiple
                            onCancel={handleCancelContentSelect}
                            onSave={handleSaveContentSelect}
                            onSelectionChange={handleContentSelection}
                            title="Seleccionar contenido"
                            maxSelections={null}
                            selectedIds={selectedContentProfiles.map(p => p.id)}
                            compact={true}
                        />
                    </Box>
                ) : (
                    <Box>
                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                                {error}
                            </Alert>
                        )}

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Has seleccionado {selectedContentProfiles.length} contenido(s). 
                            Opcionalmente, puedes agregar un mensaje explicando por qué sugieres este contenido.
                        </Typography>

                        <TextField
                            fullWidth
                            multiline
                            rows={4}
                            label="Mensaje (opcional)"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Explica por qué este contenido sería valioso para el tema..."
                            helperText={`${message.length}/500 caracteres`}
                            inputProps={{ maxLength: 500 }}
                            sx={{ mb: 2 }}
                            disabled={submitting}
                        />

                        <Button
                            variant="outlined"
                            onClick={() => setShowContentSelect(true)}
                            disabled={submitting}
                            sx={{ mr: 1 }}
                        >
                            Cambiar selección
                        </Button>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                {!showContentSelect && (
                    <>
                        <Button onClick={handleClose} disabled={submitting}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            variant="contained"
                            disabled={submitting || selectedContentProfiles.length === 0}
                            startIcon={submitting ? <CircularProgress size={20} /> : null}
                        >
                            {submitting ? 'Enviando...' : 'Sugerir Contenido'}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default ContentSuggestionModal;
