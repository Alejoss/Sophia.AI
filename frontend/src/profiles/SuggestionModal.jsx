import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
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
    useMediaQuery,
} from '@mui/material';
import { submitSuggestion } from '../api/profilesApi';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';

const schema = yup.object({
    message: yup
        .string()
        .trim()
        .required('Por favor, ingresa tu sugerencia.')
        .min(10, 'La sugerencia debe tener al menos 10 caracteres.'),
});

const SuggestionModal = ({ open, onClose }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [generalError, setGeneralError] = useState('');
    const [success, setSuccess] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setError,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: yupResolver(schema),
        defaultValues: { message: '' },
    });

    const messageValue = watch('message') || '';

    const handleClose = () => {
        if (!isSubmitting) {
            reset({ message: '' });
            setGeneralError('');
            setSuccess(false);
            onClose();
        }
    };

    const getHelperText = () => {
        if (errors.message?.message) {
            return errors.message.message;
        }
        if (messageValue.length > 0) {
            return `${messageValue.length} caracteres`;
        }
        return 'Mínimo 10 caracteres';
    };

    const onSubmit = async ({ message }) => {
        setGeneralError('');
        setSuccess(false);

        try {
            await submitSuggestion(message);
            setSuccess(true);
            reset({ message: '' });
            setTimeout(() => {
                handleClose();
            }, 2000);
        } catch (err) {
            console.error('Error submitting suggestion:', err);
            const { generalError: parsed } = applyApiErrorsToForm(
                err,
                setError,
                'Error al enviar la sugerencia. Por favor, intenta nuevamente.',
                { message: 'message' },
            );
            if (parsed) {
                setGeneralError(parsed);
            }
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
                },
            }}
        >
            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
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
                    <Box
                        sx={{
                            pt: isMobile ? 1 : 2,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                        }}
                    >
                        {success && (
                            <Alert severity="success">
                                ¡Gracias! Tu sugerencia ha sido enviada exitosamente.
                            </Alert>
                        )}
                        {generalError && (
                            <Alert severity="error">{generalError}</Alert>
                        )}
                        <TextField
                            label="Tu sugerencia"
                            {...register('message')}
                            multiline
                            rows={isMobile ? 8 : 8}
                            fullWidth
                            required
                            placeholder="Comparte tus ideas, sugerencias o comentarios sobre la plataforma..."
                            disabled={isSubmitting || success}
                            error={!!errors.message}
                            helperText={getHelperText()}
                            sx={{
                                '& .MuiInputBase-root': {
                                    fontSize: isMobile ? '16px' : 'inherit',
                                },
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
                        },
                    }}
                >
                    <Button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        fullWidth={isMobile}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        disabled={isSubmitting || success || !messageValue.trim()}
                        startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
                        fullWidth={isMobile}
                    >
                        {isSubmitting ? 'Enviando...' : success ? 'Enviado' : 'Enviar'}
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
};

export default SuggestionModal;
