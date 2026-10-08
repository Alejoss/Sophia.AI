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
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';
import { applyApiErrorsToForm } from '../utils/apiFormErrors.js';
import i18n from '../i18n';

const messageSchema = yup.object({
    message: yup
        .string()
        .max(500, () => i18n.t('topics:suggestion.messageMax'))
        .default(''),
});

/**
 * Suggest existing or newly uploaded library content for a topic.
 *
 * Important: do NOT wrap UploadContentForm in another <form>. Nested forms are
 * invalid HTML; browsers ignore the inner form, so "Guardar Contenido" never
 * creates Content/ContentProfile (nothing in Biblioteca or sugerencias).
 */
const ContentSuggestionModal = ({ open, onClose, topicId, onSuccess }) => {
    const { t } = useTranslation('topics');
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
            setGeneralError(t('suggestion.selectContent'));
            return;
        }

        setGeneralError('');

        try {
            const promises = selectedContentProfiles.map((profile) => {
                const contentId = profile.content?.id;
                if (!contentId) {
                    throw new Error(t('suggestion.invalidContentId', { id: profile.id }));
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
                err.message || t('suggestion.createError'),
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
                        {t('suggestion.choiceHelp')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            onClick={() => setStep('library')}
                            sx={{ textTransform: 'none', py: 2 }}
                        >
                            {t('suggestion.chooseLibrary')}
                        </Button>
                        <Button
                            variant="outlined"
                            size="large"
                            fullWidth
                            onClick={() => { setUploadMode('url'); setStep('upload'); }}
                            sx={{ textTransform: 'none', py: 2 }}
                        >
                            {t('suggestion.fromUrl')}
                        </Button>
                        <Button
                            variant="outlined"
                            size="large"
                            fullWidth
                            onClick={() => { setUploadMode('file'); setStep('upload'); }}
                            sx={{ textTransform: 'none', py: 2 }}
                        >
                            {t('suggestion.uploadFile')}
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
                        {t('common.back')}
                    </Button>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t('suggestion.selectHelp')}
                    </Typography>
                    <LibrarySelectMultiple
                        onCancel={handleCancelContentSelect}
                        onSave={handleSaveContentSelect}
                        onSelectionChange={handleContentSelection}
                        title={t('suggestion.selectTitle')}
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
                        {t('common.back')}
                    </Button>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {uploadMode === 'url'
                            ? t('suggestion.urlHelp')
                            : t('suggestion.fileHelp')}
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
                    {t('suggestion.selectedHelp', { count: selectedContentProfiles.length })}
                </Typography>

                <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label={t('suggestion.messageLabel')}
                    placeholder={t('suggestion.messagePlaceholder')}
                    helperText={
                        errors.message?.message ||
                        t('timeline.charCount', { count: messageValue.length })
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
                    {t('suggestion.changeSelection')}
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
            <DialogContent sx={{ pt: 3 }}>{renderStepContent()}</DialogContent>
            <DialogActions>
                {step === 'message' && (
                    <>
                        <Button onClick={handleClose} disabled={isSubmitting}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="button"
                            variant="contained"
                            onClick={handleSubmit(onSubmit)}
                            disabled={isSubmitting || selectedContentProfiles.length === 0}
                            startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
                        >
                            {isSubmitting ? t('common.sending') : t('suggestion.submit')}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default ContentSuggestionModal;
