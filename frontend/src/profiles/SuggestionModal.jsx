import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Alert,
    CircularProgress,
    useTheme,
    useMediaQuery
} from '@mui/material';
import { submitSuggestion } from '../api/profilesApi';

const SuggestionModal = ({ open, onClose }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleClose = () => {
        if (!loading) {
            setMessage('');
            setError(null);
            setSuccess(false);
            onClose();
        }
    };

    const handleMessageChange = (e) => {
        setMessage(e.target.value);
        // Clear error when user starts typing
        if (error) {
            setError(null);
        }
    };

    const handleSubmit = async () => {
        // Validate message
        if (!message || !message.trim()) {
            setError('Por favor, ingresa tu sugerencia.');
            return;
        }

        if (message.trim().length < 10) {
            setError('La sugerencia debe tener al menos 10 caracteres.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            await submitSuggestion(message.trim());
            setSuccess(true);
            // Clear message after successful submission
            setMessage('');
            // Close modal after 2 seconds
            setTimeout(() => {
                handleClose();
            }, 2000);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 
                               err.response?.data?.error || 
                               err.message || 
                               'Error al enviar la sugerencia. Por favor, intenta nuevamente.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleClose} 
            maxWidth="lg" 
            fullWidth
            fullScreen={isMobile}
            aria-labelledby="suggestion-dialog-title"
            sx={{
                '& .MuiDialog-paper': {
                    margin: isMobile ? 0 : '24px',
                    width: isMobile ? '100%' : 'auto',
                    maxHeight: isMobile ? '100%' : 'calc(100% - 48px)',
                    minWidth: isMobile ? '100%' : '600px',
                }
            }}
        >
            <DialogTitle 
                id="suggestion-dialog-title"
                sx={{
                    pb: isMobile ? 1 : 2,
                    px: isMobile ? 2 : 3,
                    pt: isMobile ? 2 : 3,
                }}
            >
                Enviar Sugerencia
            </DialogTitle>
            <DialogContent
                sx={{
                    px: isMobile ? 2 : 3,
                    pb: isMobile ? 1 : 2,
                }}
            >
                <Box sx={{ 
                    pt: isMobile ? 1 : 2, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 2 
                }}>
                    {success && (
                        <Alert severity="success">
                            ¡Gracias! Tu sugerencia ha sido enviada exitosamente.
                        </Alert>
                    )}
                    {error && (
                        <Alert severity="error">
                            {error}
                        </Alert>
                    )}
                    <TextField
                        label="Tu sugerencia"
                        value={message}
                        onChange={handleMessageChange}
                        multiline
                        rows={isMobile ? 8 : 8}
                        fullWidth
                        required
                        placeholder="Comparte tus ideas, sugerencias o comentarios sobre la plataforma..."
                        disabled={loading || success}
                        error={!!error && !success}
                        helperText={message.length > 0 ? `${message.length} caracteres` : 'Mínimo 10 caracteres'}
                        sx={{
                            '& .MuiInputBase-root': {
                                fontSize: isMobile ? '16px' : 'inherit', // Prevents zoom on iOS
                            }
                        }}
                    />
                </Box>
            </DialogContent>
            <DialogActions
                sx={{
                    px: isMobile ? 2 : 3,
                    pb: isMobile ? 2 : 2,
                    pt: isMobile ? 1 : 2,
                    flexDirection: isMobile ? 'column-reverse' : 'row',
                    gap: isMobile ? 1 : 0,
                    '& > button': {
                        width: isMobile ? '100%' : 'auto',
                        margin: isMobile ? '0 !important' : '0 0 0 8px',
                    }
                }}
            >
                <Button 
                    onClick={handleClose} 
                    disabled={loading}
                    fullWidth={isMobile}
                >
                    Cancelar
                </Button>
                <Button 
                    onClick={handleSubmit} 
                    variant="contained" 
                    color="primary"
                    disabled={loading || success || !message.trim()}
                    startIcon={loading ? <CircularProgress size={20} /> : null}
                    fullWidth={isMobile}
                >
                    {loading ? 'Enviando...' : success ? 'Enviado' : 'Enviar'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SuggestionModal;
