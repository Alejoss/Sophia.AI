import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
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
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';
import { formatFileSize } from '../utils/fileUtils';
import { applyApiErrorsToForm } from '../utils/apiFormErrors.js';

const messageSchema = yup.object({
    message: yup.string().default(''),
});

/**
 * Modal to suggest a file for URL-only content: S3 presign + PUT + confirm (same idea as UploadContentForm),
 * with multipart fallback when S3 is not configured (no default 30s cap on that path).
 */
const FileSuggestionUploadDialog = ({
    open,
    onClose,
    contentId,
    onSuccess,
    dialogTitle,
    submitLabel,
    introText,
}) => {
    const { t } = useTranslation('content');
    const resolvedTitle = dialogTitle ?? t('fileSuggestion.defaultTitle');
    const resolvedSubmit = submitLabel ?? t('fileSuggestion.submit');
    const resolvedIntro = introText ?? t('fileSuggestion.intro');
    const [suggestionFile, setSuggestionFile] = useState(null);
    const [fileError, setFileError] = useState('');
    const [generalError, setGeneralError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null);

    const {
        register,
        handleSubmit,
        reset,
        setError,
        formState: { errors },
    } = useForm({
        resolver: yupResolver(messageSchema),
        defaultValues: { message: '' },
    });

    useEffect(() => {
        if (!open) {
            setSuggestionFile(null);
            reset({ message: '' });
            setFileError('');
            setGeneralError('');
            setUploading(false);
            setUploadProgress(null);
        }
    }, [open, reset]);

    const onSubmit = async ({ message }) => {
        setFileError('');
        setGeneralError('');

        if (!suggestionFile) {
            setFileError(t('fileSuggestion.fileRequired'));
            return;
        }

        setUploading(true);
        setUploadProgress(null);
        try {
            await contentApi.uploadFileSuggestionViaS3(
                contentId,
                suggestionFile,
                message,
                (e) => {
                    if (e.total) {
                        setUploadProgress(Math.round((e.loaded / e.total) * 100));
                    }
                }
            );
            onSuccess?.();
            onClose();
        } catch (err) {
            const { generalError: parsed } = applyApiErrorsToForm(
                err,
                setError,
                t('fileSuggestion.sendError'),
            );
            if (parsed) {
                setGeneralError(parsed);
            }
        } finally {
            setUploading(false);
            setUploadProgress(null);
        }
    };

    return (
        <Dialog open={open} onClose={uploading ? undefined : onClose} maxWidth="sm" fullWidth>
            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                <DialogTitle>{resolvedTitle}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {resolvedIntro}
                    </Typography>

                    {(generalError || fileError) && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {generalError || fileError}
                        </Alert>
                    )}

                    {uploading && (
                        <Box sx={{ mb: 2 }}>
                            {uploadProgress === null ? (
                                <>
                                    <LinearProgress />
                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                        {t('fileSuggestion.preparing')}
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
                        {t('fileSuggestion.selectFile')}
                        <input
                            type="file"
                            hidden
                            onChange={(e) => {
                                setSuggestionFile(e.target.files?.[0] || null);
                                setFileError('');
                            }}
                        />
                    </Button>
                    {suggestionFile && (
                        <Typography variant="body2" sx={{ mb: 2 }}>
                            {t('fileSuggestion.fileLine', {
                                name: suggestionFile.name,
                                size: formatFileSize(suggestionFile.size),
                            })}
                        </Typography>
                    )}
                    <TextField
                        label={t('fileSuggestion.message')}
                        fullWidth
                        multiline
                        rows={3}
                        error={!!errors.message}
                        helperText={errors.message?.message}
                        disabled={uploading}
                        {...register('message')}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose} disabled={uploading}>
                        {t('actions.cancel')}
                    </Button>
                    <Button type="submit" variant="contained" disabled={uploading}>
                        {uploading ? t('fileSuggestion.uploading') : resolvedSubmit}
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
};

export default FileSuggestionUploadDialog;
