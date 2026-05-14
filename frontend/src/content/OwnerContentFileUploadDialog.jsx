import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Alert,
    LinearProgress,
    Box,
} from '@mui/material';
import contentApi from '../api/contentApi';
import { formatFileSize } from '../utils/fileUtils';

/**
 * Modal for the original uploader to attach a downloadable file to URL-only content.
 * Uses owner-attach endpoints (FileDetails only, no FileSuggestion / no message field).
 */
const OwnerContentFileUploadDialog = ({
    open,
    onClose,
    contentId,
    onSuccess,
    dialogTitle = 'Subir archivo',
    submitLabel = 'Adjuntar archivo',
    introText = (
        <>
            Para archivos grandes, la subida puede ir directo al almacenamiento con barra de progreso.
            Si el servidor no usa S3, se usará subida clásica sin límite de tiempo de 30 s.
        </>
    ),
}) => {
    const [file, setFile] = useState(null);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null);

    useEffect(() => {
        if (!open) {
            setFile(null);
            setError('');
            setUploading(false);
            setUploadProgress(null);
        }
    }, [open]);

    const handleSubmit = async () => {
        setError('');
        if (!file) {
            setError('Debes seleccionar un archivo.');
            return;
        }

        setUploading(true);
        setUploadProgress(null);
        try {
            await contentApi.uploadOwnerContentFileViaS3(contentId, file, (e) => {
                if (e.total) {
                    setUploadProgress(Math.round((e.loaded / e.total) * 100));
                }
            });
            onSuccess?.();
            onClose();
        } catch (err) {
            const raw = err?.response?.data?.error;
            let msg = err?.message || 'No se pudo adjuntar el archivo.';
            if (typeof raw === 'string') {
                msg = raw;
            } else if (raw != null && typeof raw === 'object') {
                try {
                    msg = JSON.stringify(raw);
                } catch {
                    msg = 'No se pudo adjuntar el archivo.';
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
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {introText}
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
                    <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </Button>
                {file && (
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        Archivo: {file.name} ({formatFileSize(file.size)})
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={uploading}>
                    Cancelar
                </Button>
                <Button variant="contained" onClick={handleSubmit} disabled={uploading}>
                    {uploading ? 'Subiendo…' : submitLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default OwnerContentFileUploadDialog;
