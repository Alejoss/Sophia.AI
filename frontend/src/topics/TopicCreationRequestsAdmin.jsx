import React, { useState, useEffect, useContext } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
    Box,
    Typography,
    Button,
    Alert,
    CircularProgress,
    Paper,
    Chip,
    TextField,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Link as MuiLink,
    Card,
    CardContent,
    Stack,
    Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';
import { AuthContext } from '../context/AuthContext';
import { applyApiErrorsToForm } from '../utils/apiFormErrors.js';
import i18n from '../i18n';
import { useDateLocales } from '../hooks/useDateLocales';

const approveSchema = yup.object({
    approvedTitle: yup
        .string()
        .trim()
        .required(() => i18n.t('topics:requestsAdmin.titleRequired')),
    approvedDescription: yup.string().default(''),
});

const rejectSchema = yup.object({
    rejectionReason: yup
        .string()
        .trim()
        .required(() => i18n.t('topics:requestsAdmin.rejectReasonRequired')),
});

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

const formatRequestDate = (value, intl) =>
    new Date(value).toLocaleDateString(intl, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

const TopicCreationRequestsAdmin = ({ embedded = false }) => {
    const { t } = useTranslation('topics');
    const { intl } = useDateLocales();
    const { authState, authInitialized } = useContext(AuthContext);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterStatus, setFilterStatus] = useState('PENDING');
    const [processingIds, setProcessingIds] = useState(new Set());
    const [approveDialogOpen, setApproveDialogOpen] = useState(false);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [approveGeneralError, setApproveGeneralError] = useState('');
    const [rejectGeneralError, setRejectGeneralError] = useState('');

    const {
        register: registerApprove,
        handleSubmit: handleApproveSubmit,
        reset: resetApproveForm,
        setError: setApproveFormError,
        formState: { errors: approveErrors, isSubmitting: isApproveSubmitting },
    } = useForm({
        resolver: yupResolver(approveSchema),
        defaultValues: { approvedTitle: '', approvedDescription: '' },
    });

    const {
        register: registerReject,
        handleSubmit: handleRejectSubmit,
        reset: resetRejectForm,
        setError: setRejectFormError,
        formState: { errors: rejectErrors, isSubmitting: isRejectSubmitting },
    } = useForm({
        resolver: yupResolver(rejectSchema),
        defaultValues: { rejectionReason: '' },
    });

    const isStaff = Boolean(authState.user?.is_staff || authState.user?.is_superuser);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const filters = {};
            if (filterStatus && filterStatus !== 'all') {
                filters.status = filterStatus;
            }
            const data = await contentApi.getAdminTopicCreationRequests(filters);
            setRequests(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err) {
            setError(t('requestsAdmin.loadError'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isStaff) {
            fetchRequests();
        }
    }, [filterStatus, isStaff]);

    if (!authInitialized) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!embedded && (!authState.isAuthenticated || !isStaff)) {
        return <Navigate to="/" replace />;
    }

    const openApproveDialog = (request) => {
        setSelectedRequest(request);
        resetApproveForm({
            approvedTitle: request.proposed_title,
            approvedDescription: request.proposed_description || '',
        });
        setApproveGeneralError('');
        setApproveDialogOpen(true);
    };

    const openRejectDialog = (request) => {
        setSelectedRequest(request);
        resetRejectForm({ rejectionReason: '' });
        setRejectGeneralError('');
        setRejectDialogOpen(true);
    };

    const onApproveSubmit = async ({ approvedTitle, approvedDescription }) => {
        if (!selectedRequest) return;

        const requestId = selectedRequest.id;
        setProcessingIds((prev) => new Set(prev).add(requestId));
        setApproveGeneralError('');

        try {
            await contentApi.approveTopicCreationRequest(requestId, {
                approved_title: approvedTitle,
                approved_description: approvedDescription,
            });
            setApproveDialogOpen(false);
            setSelectedRequest(null);
            await fetchRequests();
        } catch (err) {
            const { generalError } = applyApiErrorsToForm(
                err,
                setApproveFormError,
                t('requestsAdmin.approveError'),
                {
                    approved_title: 'approvedTitle',
                    approved_description: 'approvedDescription',
                },
            );
            if (generalError) {
                setApproveGeneralError(generalError);
            }
        } finally {
            setProcessingIds((prev) => {
                const next = new Set(prev);
                next.delete(requestId);
                return next;
            });
        }
    };

    const onRejectSubmit = async ({ rejectionReason }) => {
        if (!selectedRequest) return;

        const requestId = selectedRequest.id;
        setProcessingIds((prev) => new Set(prev).add(requestId));
        setRejectGeneralError('');

        try {
            await contentApi.rejectTopicCreationRequest(requestId, {
                rejection_reason: rejectionReason,
            });
            setRejectDialogOpen(false);
            setSelectedRequest(null);
            await fetchRequests();
        } catch (err) {
            const { generalError } = applyApiErrorsToForm(
                err,
                setRejectFormError,
                t('requestsAdmin.rejectError'),
                { rejection_reason: 'rejectionReason' },
            );
            if (generalError) {
                setRejectGeneralError(generalError);
            }
        } finally {
            setProcessingIds((prev) => {
                const next = new Set(prev);
                next.delete(requestId);
                return next;
            });
        }
    };

    const handleFinalize = async (request) => {
        setProcessingIds((prev) => new Set(prev).add(request.id));
        setError(null);
        try {
            await contentApi.finalizeTopicCreationRequest(request.id);
            await fetchRequests();
        } catch (err) {
            setError(err.response?.data?.error || t('requestsAdmin.publishError'));
        } finally {
            setProcessingIds((prev) => {
                const next = new Set(prev);
                next.delete(request.id);
                return next;
            });
        }
    };

    const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

    const renderRequestCard = (request) => (
        <Card key={request.id} variant="outlined">
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 2,
                        flexWrap: 'wrap',
                    }}
                >
                    <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                            {t('requestsAdmin.requester')}
                        </Typography>
                        <MuiLink
                            component={Link}
                            to={`/profiles/user_profile/${request.requested_by?.id}`}
                            underline="hover"
                            variant="body2"
                            fontWeight={600}
                        >
                            {request.requested_by?.username}
                        </MuiLink>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip
                            label={statusLabel(request.status, t)}
                            color={STATUS_COLORS[request.status] || 'default'}
                            size="small"
                        />
                        <Typography variant="caption" color="text.secondary">
                            {formatRequestDate(request.created_at, intl)}
                        </Typography>
                    </Stack>
                </Box>

                <Box>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        {t('requestsAdmin.proposedTitle')}
                    </Typography>
                    <Typography variant="h6" component="p" sx={{ fontSize: '1.05rem', fontWeight: 600 }}>
                        {request.proposed_title}
                    </Typography>
                </Box>

                <Box>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        {t('requestsAdmin.proposedDescription')}
                    </Typography>
                    <Typography
                        variant="body2"
                        color={request.proposed_description ? 'text.primary' : 'text.secondary'}
                        sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}
                    >
                        {request.proposed_description || t('requestsAdmin.noDescription')}
                    </Typography>
                </Box>

                {(request.status === 'APPROVED' || request.status === 'COMPLETED') && (
                    <Box
                        sx={{
                            p: 2,
                            borderRadius: 1,
                            bgcolor: (theme) =>
                                theme.palette.mode === 'dark'
                                    ? 'rgba(46, 125, 50, 0.2)'
                                    : 'rgba(46, 125, 50, 0.08)',
                        }}
                    >
                        <Typography variant="caption" color="success.dark" display="block" gutterBottom>
                            {t('requestsAdmin.approvedVersion')}
                        </Typography>
                        <Typography variant="subtitle2" fontWeight={600}>
                            {request.approved_title}
                        </Typography>
                        {request.approved_description && (
                            <Typography
                                variant="body2"
                                sx={{ mt: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                            >
                                {request.approved_description}
                            </Typography>
                        )}
                    </Box>
                )}

                {request.status === 'REJECTED' && request.rejection_reason && (
                    <Alert severity="error" sx={{ py: 0.5 }}>
                        <Typography variant="caption" display="block" fontWeight={600}>
                            {t('requestsAdmin.rejectReason')}
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {request.rejection_reason}
                        </Typography>
                    </Alert>
                )}

                {(request.status === 'PENDING'
                    || request.status === 'APPROVED'
                    || (request.status === 'COMPLETED' && request.topic_id)) && (
                    <>
                        <Divider />
                        <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap">
                            {request.status === 'PENDING' && (
                                <>
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        startIcon={<CancelIcon />}
                                        onClick={() => openRejectDialog(request)}
                                        disabled={processingIds.has(request.id)}
                                    >
                                        {t('requestsAdmin.reject')}
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="success"
                                        startIcon={<CheckCircleIcon />}
                                        onClick={() => openApproveDialog(request)}
                                        disabled={processingIds.has(request.id)}
                                    >
                                        {t('requestsAdmin.approvePublish')}
                                    </Button>
                                </>
                            )}
                            {request.status === 'APPROVED' && !request.topic_id && (
                                <Button
                                    variant="contained"
                                    color="success"
                                    onClick={() => handleFinalize(request)}
                                    disabled={processingIds.has(request.id)}
                                >
                                    {t('requestsAdmin.finalize')}
                                </Button>
                            )}
                            {request.status === 'COMPLETED' && request.topic_id && (
                                <Button
                                    component={Link}
                                    to={`/content/topics/${request.topic_id}`}
                                    variant="outlined"
                                >
                                    {t('requestsAdmin.viewCreated')}
                                </Button>
                            )}
                        </Stack>
                    </>
                )}
            </CardContent>
        </Card>
    );

    return (
        <Box sx={embedded ? undefined : { pt: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: 900, mx: 'auto' }}>
            {!embedded && (
                <>
                    <Typography variant="h4" gutterBottom>
                        {t('requestsAdmin.pageTitle')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        {t('requestsAdmin.intro')}
                    </Typography>
                </>
            )}
            {embedded && (
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                    {t('requestsAdmin.pageTitle')}
                </Typography>
            )}

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>{t('common.status')}</InputLabel>
                    <Select
                        value={filterStatus}
                        label={t('common.status')}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <MenuItem value="all">{t('common.all')}</MenuItem>
                        <MenuItem value="PENDING">{t('requestsAdmin.filterPending')}</MenuItem>
                        <MenuItem value="APPROVED">{t('requestsAdmin.filterApproved')}</MenuItem>
                        <MenuItem value="REJECTED">{t('requestsAdmin.filterRejected')}</MenuItem>
                        <MenuItem value="CANCELLED">{t('requestsAdmin.filterCancelled')}</MenuItem>
                        <MenuItem value="COMPLETED">{t('requestsAdmin.filterCompleted')}</MenuItem>
                    </Select>
                </FormControl>
                {filterStatus === 'PENDING' && pendingCount > 0 && (
                    <Chip label={t('requestsAdmin.pending', { count: pendingCount })} color="warning" />
                )}
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                </Box>
            ) : requests.length === 0 ? (
                <Alert severity="info">{t('requestsAdmin.emptyFilter')}</Alert>
            ) : (
                <Stack spacing={2} component={Paper} variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
                    {requests.map(renderRequestCard)}
                </Stack>
            )}

            <Dialog
                open={approveDialogOpen}
                onClose={() => !isApproveSubmitting && setApproveDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <Box component="form" onSubmit={handleApproveSubmit(onApproveSubmit)} noValidate>
                    <DialogTitle>{t('requestsAdmin.approveDialogTitle')}</DialogTitle>
                    <DialogContent>
                        {approveGeneralError && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {approveGeneralError}
                            </Alert>
                        )}
                        {selectedRequest && (
                            <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    {t('requestsAdmin.proposalBy', { user: selectedRequest.requested_by?.username })}
                                </Typography>
                                <Typography variant="subtitle2" sx={{ mt: 0.5 }}>
                                    {selectedRequest.proposed_title}
                                </Typography>
                                {selectedRequest.proposed_description && (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ mt: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                    >
                                        {selectedRequest.proposed_description}
                                    </Typography>
                                )}
                            </Box>
                        )}
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {t('requestsAdmin.approveHelp')}
                        </Typography>
                        <TextField
                            fullWidth
                            label={t('requestsAdmin.approvedTitle')}
                            error={!!approveErrors.approvedTitle}
                            helperText={approveErrors.approvedTitle?.message}
                            disabled={isApproveSubmitting}
                            sx={{ mb: 2, mt: 1 }}
                            {...registerApprove('approvedTitle')}
                        />
                        <TextField
                            fullWidth
                            label={t('requestsAdmin.approvedDescription')}
                            multiline
                            minRows={4}
                            error={!!approveErrors.approvedDescription}
                            helperText={approveErrors.approvedDescription?.message}
                            disabled={isApproveSubmitting}
                            {...registerApprove('approvedDescription')}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setApproveDialogOpen(false)} disabled={isApproveSubmitting}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            color="success"
                            disabled={isApproveSubmitting || processingIds.has(selectedRequest?.id)}
                        >
                            {isApproveSubmitting ? t('requestsAdmin.approving') : t('requestsAdmin.approvePublish')}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            <Dialog
                open={rejectDialogOpen}
                onClose={() => !isRejectSubmitting && setRejectDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <Box component="form" onSubmit={handleRejectSubmit(onRejectSubmit)} noValidate>
                    <DialogTitle>{t('requestsAdmin.rejectDialogTitle')}</DialogTitle>
                    <DialogContent>
                        {rejectGeneralError && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {rejectGeneralError}
                            </Alert>
                        )}
                        {selectedRequest && (
                            <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    {t('requestsAdmin.proposalBy', { user: selectedRequest.requested_by?.username })}
                                </Typography>
                                <Typography variant="subtitle2" sx={{ mt: 0.5 }}>
                                    {selectedRequest.proposed_title}
                                </Typography>
                                {selectedRequest.proposed_description && (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ mt: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                    >
                                        {selectedRequest.proposed_description}
                                    </Typography>
                                )}
                            </Box>
                        )}
                        <TextField
                            fullWidth
                            label={t('requestsAdmin.rejectReason')}
                            multiline
                            minRows={3}
                            error={!!rejectErrors.rejectionReason}
                            helperText={rejectErrors.rejectionReason?.message}
                            disabled={isRejectSubmitting}
                            sx={{ mt: 1 }}
                            placeholder={t('requestsAdmin.rejectPlaceholder')}
                            {...registerReject('rejectionReason')}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setRejectDialogOpen(false)} disabled={isRejectSubmitting}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            color="error"
                            disabled={isRejectSubmitting || processingIds.has(selectedRequest?.id)}
                        >
                            {isRejectSubmitting ? t('requestsAdmin.rejecting') : t('requestsAdmin.reject')}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Box>
    );
};

export default TopicCreationRequestsAdmin;
