import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
    Box,
    Grid,
    TextField,
    Button,
    Typography,
    Paper,
    Alert,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
} from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';
import i18n from '../i18n';

const MAX_PENDING_TOPIC_REQUESTS = 3;

const statusLabel = (status, t) => {
    const labels = {
        PENDING: t('creation.statusPending'),
        APPROVED: t('creation.statusApproved'),
        REJECTED: t('creation.statusRejected'),
        COMPLETED: t('creation.statusCompleted'),
        CANCELLED: t('creation.statusCancelled'),
    };
    return labels[status] || status;
};

const STATUS_COLORS = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'error',
    COMPLETED: 'default',
    CANCELLED: 'default',
};

const requestSchema = yup.object({
    proposed_title: yup
        .string()
        .trim()
        .required(() => i18n.t('topics:creation.titleRequired')),
    proposed_description: yup.string().trim().default(''),
});

const TopicCreationForm = () => {
    const { t } = useTranslation('topics');
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [loadingRequests, setLoadingRequests] = useState(true);
    const [creatingTopicId, setCreatingTopicId] = useState(null);
    const [cancellingId, setCancellingId] = useState(null);
    const [formGeneralError, setFormGeneralError] = useState('');
    const [actionError, setActionError] = useState('');
    const [success, setSuccess] = useState(null);

    const {
        register,
        handleSubmit,
        reset,
        setError,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: yupResolver(requestSchema),
        defaultValues: { proposed_title: '', proposed_description: '' },
    });

    const fetchRequests = useCallback(async () => {
        try {
            setLoadingRequests(true);
            const data = await contentApi.getTopicCreationRequests();
            setRequests(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error loading topic creation requests:', err);
        } finally {
            setLoadingRequests(false);
        }
    }, []);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const pendingCount = requests.filter((req) => req.status === 'PENDING').length;
    const atPendingLimit = pendingCount >= MAX_PENDING_TOPIC_REQUESTS;

    const onSubmitRequest = async (formData) => {
        setFormGeneralError('');
        setActionError('');
        setSuccess(null);

        try {
            await contentApi.createTopicCreationRequest(formData);
            setSuccess(t('creation.sent'));
            reset({ proposed_title: '', proposed_description: '' });
            await fetchRequests();
        } catch (err) {
            console.error('Error submitting topic creation request:', err);
            const { generalError: parsed } = applyApiErrorsToForm(
                err,
                setError,
                t('creation.submitError'),
                { proposed_title: 'proposed_title', proposed_description: 'proposed_description' },
            );
            if (parsed) {
                setFormGeneralError(parsed);
            }
        }
    };

    const handleCreateTopic = async (request) => {
        setCreatingTopicId(request.id);
        setActionError('');
        setSuccess(null);
        try {
            const response = await contentApi.createTopic({
                creation_request_id: request.id,
            });
            const topicId = response?.id ?? response?.data?.id;
            if (topicId) {
                navigate(`/content/topics/${topicId}/edit`, { replace: true });
                return;
            }
            await fetchRequests();
            setSuccess(t('creation.created'));
        } catch (err) {
            setActionError(err.response?.data?.error || t('creation.createError'));
        } finally {
            setCreatingTopicId(null);
        }
    };

    const handleCancelRequest = async (request) => {
        setCancellingId(request.id);
        setActionError('');
        setSuccess(null);
        try {
            await contentApi.cancelTopicCreationRequest(request.id);
            setSuccess(t('creation.cancelled'));
            await fetchRequests();
        } catch (err) {
            setActionError(err.response?.data?.error || t('creation.cancelError'));
        } finally {
            setCancellingId(null);
        }
    };

    return (
        <Box
            sx={{
                pt: { xs: 2, md: 4 },
                px: { xs: 1, md: 3 },
                maxWidth: 1000,
                mx: 'auto',
                color: 'text.primary',
            }}
        >
            <Grid container spacing={3}>
                <Grid item xs={12} md={7}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography
                            variant="h4"
                            gutterBottom
                            color="text.primary"
                            sx={{
                                fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
                                fontWeight: 400,
                                fontSize: { xs: '20px', sm: '24px', md: '24px' },
                            }}
                        >
                            {t('creation.pageTitle')}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {t('creation.intro')}
                        </Typography>

                        {actionError && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {actionError}
                            </Alert>
                        )}

                        {success && (
                            <Alert severity="success" sx={{ mb: 2 }}>
                                {success}
                            </Alert>
                        )}

                        {atPendingLimit ? (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                {t('creation.pendingLimit', { count: MAX_PENDING_TOPIC_REQUESTS })}
                            </Alert>
                        ) : (
                            <form onSubmit={handleSubmit(onSubmitRequest)} noValidate>
                                {formGeneralError && (
                                    <Alert severity="error" sx={{ mb: 2 }}>
                                        {formGeneralError}
                                    </Alert>
                                )}

                                <TextField
                                    fullWidth
                                    label={t('creation.proposedTitle')}
                                    placeholder={t('creation.titlePlaceholder')}
                                    {...register('proposed_title')}
                                    error={!!errors.proposed_title}
                                    helperText={
                                        errors.proposed_title?.message ||
                                        t('creation.titleHelp')
                                    }
                                    required
                                    sx={{ mb: 2 }}
                                />

                                <TextField
                                    fullWidth
                                    label={t('creation.proposedDescription')}
                                    {...register('proposed_description')}
                                    error={!!errors.proposed_description}
                                    helperText={errors.proposed_description?.message}
                                    multiline
                                    rows={4}
                                    sx={{ mb: 3 }}
                                />

                                <Button
                                    type="submit"
                                    variant="contained"
                                    color="primary"
                                    fullWidth
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? t('creation.sending') : t('creation.submit')}
                                </Button>
                            </form>
                        )}

                        <Box sx={{ mt: 4 }}>
                            <Typography variant="h6" gutterBottom>
                                {t('creation.myRequests')}
                            </Typography>
                            {loadingRequests ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                    <CircularProgress size={28} />
                                </Box>
                            ) : requests.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                    {t('creation.empty')}
                                </Typography>
                            ) : (
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>{t('common.title')}</TableCell>
                                                <TableCell>{t('common.status')}</TableCell>
                                                <TableCell align="right">{t('creation.action')}</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {requests.map((request) => (
                                                <TableRow key={request.id}>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={500}>
                                                            {request.status === 'APPROVED' || request.status === 'COMPLETED'
                                                                ? request.approved_title
                                                                : request.proposed_title}
                                                        </Typography>
                                                        {request.status === 'REJECTED' && request.rejection_reason && (
                                                            <Typography variant="caption" color="error">
                                                                {request.rejection_reason}
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={statusLabel(request.status, t)}
                                                            color={STATUS_COLORS[request.status] || 'default'}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {request.status === 'PENDING' && (
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                color="error"
                                                                onClick={() => handleCancelRequest(request)}
                                                                disabled={cancellingId === request.id}
                                                            >
                                                                {cancellingId === request.id ? t('creation.cancelling') : t('common.cancel')}
                                                            </Button>
                                                        )}
                                                        {request.status === 'APPROVED' && (
                                                            <Button
                                                                size="small"
                                                                variant="contained"
                                                                onClick={() => handleCreateTopic(request)}
                                                                disabled={creatingTopicId === request.id}
                                                            >
                                                                {creatingTopicId === request.id ? t('creation.creating') : t('creation.createTopic')}
                                                            </Button>
                                                        )}
                                                        {request.status === 'COMPLETED' && request.topic_id && (
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                onClick={() => navigate(`/content/topics/${request.topic_id}`)}
                                                            >
                                                                {t('creation.viewTopic')}
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Box>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={5}>
                    <Paper
                        sx={{
                            p: 3,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.5,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Box
                                sx={{
                                    mr: 1.5,
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    bgcolor: 'primary.light',
                                    color: 'primary.contrastText',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <LightbulbIcon fontSize="small" />
                            </Box>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                {t('creation.guideTitle')}
                            </Typography>
                        </Box>

                        <Typography variant="body2" color="text.secondary">
                            {t('creation.guideBody')}
                        </Typography>

                        <Box sx={{ mt: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {t('creation.thinkTitle')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('creation.tipNarrow')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('creation.tipContext')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('creation.tipConnect')}
                            </Typography>
                        </Box>

                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {t('creation.avoidTitle')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">{t('creation.avoidTerrorism')}</Typography>
                            <Typography variant="body2" color="text.secondary">{t('creation.avoidMedicine')}</Typography>
                            <Typography variant="body2" color="text.secondary">{t('creation.avoidPolitics')}</Typography>
                        </Box>

                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {t('creation.betterTitle')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('creation.exampleHoney')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('creation.exampleOklahoma')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('creation.exampleYouth')}
                            </Typography>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default TopicCreationForm;
