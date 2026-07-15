import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
    Dialog,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    Alert,
    CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LibrarySelectMultiple from '../content/LibrarySelectMultiple';
import UploadContentForm from '../content/UploadContentForm';
import contentApi from '../api/contentApi';
import { applyApiErrorsToForm } from '../utils/apiFormErrors.js';

const messageSchema = yup.object({
    message: yup
        .string()
        .max(500, 'El mensaje no puede superar 500 caracteres.')
        .default(''),
});

const ContentSuggestionModal = ({ open, onClose, topicId, onSuccess }) => {
    const [selectedContentProfiles, setSelectedContentProfiles] = useState([]);
    const [step, setStep] = useState('choice');
    const [uploadMode, setUploadMode] = useState('file');
    const [uploadInProgress, setUploadInProgress] = useState(false);
    const [generalError, setGeneralError] = useState('');

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setError,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: yupResolver(messageSchema),
        defaultValues: { message: '' },
    });

    const messageValue = watch('message') || '';

    const handleContentSelection = (selectedProfiles) => {
        setSelectedContentProfiles(selectedProfiles);
    };

    const handleCancelContentSelect = () => {
        setStep('choice');
        onClose();
    };

    const handleBackToChoice = () => {
        setStep('choice');
    };

    const handleSaveContentSelect = () => {
        setStep('message');
    };

    const handleContentUploaded = (contentProfile) => {
        setSelectedContentProfiles([contentProfile]);
        setStep('message');
    };

    const handleChangeSelection = () => {
        setSelectedContentProfiles([]);
        setStep('choice');
    };

    const onSubmit = async ({ message }) => {
        if (selectedContentProfiles.length === 0) {
            setGeneralError('Debe seleccionar al menos un contenido para sugerir');
            return;
        }

        setGeneralError('');

        try {
            const promises = selectedContentProfiles.map(profile => {
                const contentId = profile.content?.id;
                if (!contentId) {
                    throw new Error(`Contenido sin ID válido para el perfil ${profile.id}`);
                }
                return contentApi.createContentSuggestion(topicId, contentId, message.trim());
            });

            await Promise.all(promises);

            setSelectedContentProfiles([]);
            reset({ message: '' });
            setStep('choice');

            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (err) {
            const { generalError: parsed } = applyApiErrorsToForm(
                err,
                setError,
                err.message || 'Error al crear la sugerencia. Por favor, inténtelo de nuevo.',
                { suggestion_message: 'message', message: 'message' },
            );
            if (parsed) {
                setGeneralError(parsed);
            }
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setSelectedContentProfiles([]);
            reset({ message: '' });
            setGeneralError('');
            setStep('choice');
            setUploadInProgress(false);
            onClose();
        }
    };

    const renderStepContent = () => {
        if (step === 'choice') {
            return (
                <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Elige de la biblioteca, desde una URL o sube un archivo para sugerir.
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            onClick={() => setStep('library')}
                            sx={{ textTransform: 'none', py: 2 }}
                        >
                            Elegir de la biblioteca
                        </Button>
                        <Button
                            variant="outlined"
                            size="large"
                            fullWidth
                            onClick={() => { setUploadMode('url'); setStep('upload'); }}
                            sx={{ textTransform: 'none', py: 2 }}
                        >
                            Desde URL
                        </Button>
                        <Button
                            variant="outlined"
                            size="large"
                            fullWidth
                            onClick={() => { setUploadMode('file'); setStep('upload'); }}
                            sx={{ textTransform: 'none', py: 2 }}
                        >
                            Subir archivo
                        </Button>
                    </Box>
                </Box>
            );
        }

        if (step === 'library') {
            return (
                <Box>
                    <Button
                        variant="text"
                        startIcon={<ArrowBackIcon />}
                        onClick={handleBackToChoice}
                        sx={{ mb: 2, textTransform: 'none' }}
                    >
                        Volver
                    </Button>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Selecciona el contenido que deseas sugerir para este tema.
                    </Typography>
                    <LibrarySelectMultiple
                        onCancel={handleCancelContentSelect}
                        onSave={handleSaveContentSelect}
                        onSelectionChange={handleContentSelection}
                        title="Seleccionar contenido"
                        maxSelections={null}
                        selectedIds={selectedContentProfiles.map((p) => p.id)}
                        compact={true}
                    />
                </Box>
            );
        }

        if (step === 'upload') {
            return (
                <Box>
                    <Button
                        variant="text"
                        startIcon={<ArrowBackIcon />}
                        onClick={handleBackToChoice}
                        sx={{ mb: 2, textTransform: 'none' }}
                        disabled={uploadInProgress}
                    >
                        Volver
                    </Button>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {uploadMode === 'url'
                            ? 'Indica la URL del contenido que quieres sugerir.'
                            : 'Sube el archivo del contenido que quieres sugerir.'}
                    </Typography>
                    <UploadContentForm
                        onContentUploaded={handleContentUploaded}
                        onUploadingChange={setUploadInProgress}
                        initialUrlMode={uploadMode === 'url'}
                        showModeToggle={false}
                    />
                </Box>
            );
        }

        return (
            <Box>
                {generalError && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setGeneralError('')}>
                        {generalError}
                    </Alert>
                )}

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Has seleccionado {selectedContentProfiles.length} contenido(s). Opcionalmente,
                    puedes agregar un mensaje explicando por qué sugieres este contenido.
                </Typography>

                <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Mensaje para moderadores (opcional)"
                    placeholder="Explica por qué este contenido sería valioso para el tema..."
                    helperText={
                        errors.message?.message ||
                        `${messageValue.length}/500 caracteres`
                    }
                    error={!!errors.message}
                    inputProps={{ maxLength: 500 }}
                    sx={{ mb: 2 }}
                    disabled={isSubmitting}
                    {...register('message')}
                />

                <Button
                    variant="outlined"
                    onClick={handleChangeSelection}
                    disabled={isSubmitting}
                    sx={{ mr: 1 }}
                >
                    Cambiar selección
                </Button>
            </Box>
        );
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            disableEscapeKeyDown={isSubmitting}
        >
            <Box
                component="form"
                onSubmit={step === 'message' ? handleSubmit(onSubmit) : (e) => e.preventDefault()}
                noValidate
            >
                <DialogContent sx={{ pt: 3 }}>{renderStepContent()}</DialogContent>
                <DialogActions>
                    {step === 'message' && (
                        <>
                            <Button onClick={handleClose} disabled={isSubmitting}>
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={isSubmitting || selectedContentProfiles.length === 0}
                                startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
                            >
                                {isSubmitting ? 'Enviando...' : 'Sugerir Contenido'}
                            </Button>
                        </>
                    )}
                </DialogActions>
            </Box>
        </Dialog>
    );
};

export default ContentSuggestionModal;
