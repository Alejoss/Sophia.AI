import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    TextField,
    Alert,
    LinearProgress,
    Box,
} from '@mui/material';
import contentApi from '../api/contentApi';
import { formatFileSize } from '../utils/fileUtils';

/**
 * Modal to suggest a file for URL-only content: S3 presign + PUT + confirm (same idea as UploadContentForm),
 * with multipart fallback when S3 is not configured (no default 30s cap on that path).
 */
const FileSuggestionUploadDialog = ({ open, onClose, contentId, onSuccess }) => {
    const [suggestionFile, setSuggestionFile] = useState(null);
    const [suggestionMessage, setSuggestionMessage] = useState('');
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null);

    useEffect(() => {
        if (!open) {
            setSuggestionFile(null);
            setSuggestionMessage('');
            setError('');
            setUploading(false);
            setUploadProgress(null);
        }
    }, [open]);

    const handleSubmit = async () => {
        setError('');
        if (!suggestionFile) {
            setError('Debes seleccionar un archivo.');
            return;
        }

        setUploading(true);
        // null = fase presign/confirm (barra indeterminada); número = progreso del PUT a S3
        setUploadProgress(null);
        try {
            await contentApi.uploadFileSuggestionViaS3(
                contentId,
                suggestionFile,
                suggestionMessage,
                (e) => {
                    if (e.total) {
                        setUploadProgress(Math.round((e.loaded / e.total) * 100));
                    }
                }
            );
            onSuccess?.();
            onClose();
        } catch (err) {
            const raw = err?.response?.data?.error;
            let msg = err?.message || 'No se pudo enviar la sugerencia.';
            if (typeof raw === 'string') {
                msg = raw;
            } else if (raw != null && typeof raw === 'object') {
                try {
                    msg = JSON.stringify(raw);
                } catch {
                    msg = 'No se pudo enviar la sugerencia.';
                }
            } else if (raw != null) {
                msg = String(raw);
            }
            setError(msg);
        } finally {
            setUploading(false);
            setUploadProgress(null);
        }
    };

    return (
        <Dialog open={open} onClose={uploading ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Sugerir archivo</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Para archivos grandes (p. ej. documentales), la subida va directo al almacenamiento con barra
                    de progreso. Si el servidor no usa S3, se usará subida clásica sin límite de tiempo de 30 s.
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {uploading && (
                    <Box sx={{ mb: 2 }}>
                        {uploadProgress === null ? (
                            <>
                                <LinearProgress />
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                    Preparando subida…
                                </Typography>
                            </>
                        ) : (
                            <>
                                <LinearProgress variant="determinate" value={uploadProgress} />
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                    {uploadProgress}%
                                </Typography>
                            </>
                        )}
                    </Box>
                )}

                <Button variant="outlined" component="label" sx={{ mb: 2 }} disabled={uploading}>
                    Seleccionar archivo
                    <input
                        type="file"
                        hidden
                        onChange={(e) => setSuggestionFile(e.target.files?.[0] || null)}
                    />
                </Button>
                {suggestionFile && (
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        Archivo: {suggestionFile.name} ({formatFileSize(suggestionFile.size)})
                    </Typography>
                )}
                <TextField
                    label="Mensaje (opcional)"
                    fullWidth
                    multiline
                    rows={3}
                    value={suggestionMessage}
                    onChange={(e) => setSuggestionMessage(e.target.value)}
                    disabled={uploading}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={uploading}>
                    Cancelar
                </Button>
                <Button variant="contained" onClick={handleSubmit} disabled={uploading}>
                    {uploading ? 'Subiendo…' : 'Enviar sugerencia'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default FileSuggestionUploadDialog;
