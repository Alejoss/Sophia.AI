import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
    Box,
    Typography,
    Button,
    Alert,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
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
    IconButton,
    Tooltip,
    Link
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';
import { getContentOpenInNewTabUrl } from '../utils/fileUtils';
import { applyApiErrorsToForm } from '../utils/apiFormErrors.js';
import i18n from '../i18n';
import { useDateLocales } from '../hooks/useDateLocales';

const rejectSchema = yup.object({
    reason: yup
        .string()
        .trim()
        .required(() => i18n.t('topics:suggestion.rejectReasonRequired')),
});

const ContentSuggestionsManager = ({ topicId, onSuggestionProcessed }) => {
    const { t } = useTranslation('topics');
    const { intl } = useDateLocales();
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterStatus, setFilterStatus] = useState('PENDING');
    const [filterDuplicate, setFilterDuplicate] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [processingIds, setProcessingIds] = useState(new Set());
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState(null);
    const [rejectGeneralError, setRejectGeneralError] = useState('');

    const {
        register: registerReject,
        handleSubmit: handleRejectSubmit,
        reset: resetRejectForm,
        setError: setRejectFormError,
        formState: { errors: rejectErrors, isSubmitting: isRejectSubmitting },
    } = useForm({
        resolver: yupResolver(rejectSchema),
        defaultValues: { reason: '' },
    });

    const fetchSuggestions = async () => {
        try {
            setLoading(true);
            const filters = {};
            if (filterStatus && filterStatus !== 'all') {
                filters.status = filterStatus;
            }
            if (filterDuplicate !== 'all') {
                filters.is_duplicate = filterDuplicate === 'true';
            }
            
            const data = await contentApi.getTopicContentSuggestions(topicId, filters);
            setSuggestions(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err) {
            setError(t('suggestion.loadError'));
            console.error('Error fetching suggestions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuggestions();
    }, [topicId, filterStatus, filterDuplicate]);

    const handleAccept = async (suggestion) => {
        setProcessingIds(prev => new Set(prev).add(suggestion.id));
        setError(null);
        
        try {
            await contentApi.acceptContentSuggestion(topicId, suggestion.id);
            await fetchSuggestions();
            if (onSuggestionProcessed) {
                onSuggestionProcessed();
            }
        } catch (err) {
            setError(err.response?.data?.error || t('suggestion.acceptError'));
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(suggestion.id);
                return newSet;
            });
        }
    };

    const handleRejectClick = (suggestion) => {
        setSelectedSuggestion(suggestion);
        resetRejectForm({ reason: '' });
        setRejectGeneralError('');
        setRejectDialogOpen(true);
    };

    const onRejectSubmit = async ({ reason }) => {
        if (!selectedSuggestion) return;

        const suggestionId = selectedSuggestion.id;
        setProcessingIds(prev => new Set(prev).add(suggestionId));
        setRejectGeneralError('');
        setError(null);

        try {
            await contentApi.rejectContentSuggestion(topicId, suggestionId, reason);
            setRejectDialogOpen(false);
            setSelectedSuggestion(null);
            resetRejectForm({ reason: '' });
            await fetchSuggestions();
            if (onSuggestionProcessed) {
                onSuggestionProcessed();
            }
        } catch (err) {
            const { generalError } = applyApiErrorsToForm(
                err,
                setRejectFormError,
                t('suggestion.rejectError'),
                { rejection_reason: 'reason' },
            );
            if (generalError) {
                setRejectGeneralError(generalError);
            }
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(suggestionId);
                return newSet;
            });
        }
    };

    const getStatusChip = (status) => {
        const statusConfig = {
            PENDING: { label: t('common.pending'), color: 'warning' },
            ACCEPTED: { label: t('suggestion.statusAccepted'), color: 'success' },
            REJECTED: { label: t('suggestion.statusRejected'), color: 'error' }
        };
        const config = statusConfig[status] || { label: status, color: 'default' };
        return <Chip label={config.label} color={config.color} size="small" />;
    };

    const filteredSuggestions = suggestions.filter(suggestion => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        const contentTitle = suggestion.content?.original_title || '';
        const suggesterName = suggestion.suggested_by?.username || '';
        return contentTitle.toLowerCase().includes(searchLower) || 
               suggesterName.toLowerCase().includes(searchLower);
    });

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    {t('suggestion.managerTitle')}
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>{t('common.status')}</InputLabel>
                    <Select
                        value={filterStatus}
                        label={t('common.status')}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <MenuItem value="all">{t('common.all')}</MenuItem>
                        <MenuItem value="PENDING">{t('suggestion.statusPendingPlural')}</MenuItem>
                        <MenuItem value="ACCEPTED">{t('suggestion.statusAcceptedPlural')}</MenuItem>
                        <MenuItem value="REJECTED">{t('suggestion.statusRejectedPlural')}</MenuItem>
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>{t('suggestion.duplicates')}</InputLabel>
                    <Select
                        value={filterDuplicate}
                        label={t('suggestion.duplicates')}
                        onChange={(e) => setFilterDuplicate(e.target.value)}
                    >
                        <MenuItem value="all">{t('suggestion.allFeminine')}</MenuItem>
                        <MenuItem value="true">{t('suggestion.onlyDuplicates')}</MenuItem>
                        <MenuItem value="false">{t('suggestion.notDuplicates')}</MenuItem>
                    </Select>
                </FormControl>

                <TextField
                    size="small"
                    placeholder={t('suggestion.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    }}
                    sx={{ flexGrow: 1, maxWidth: 300 }}
                />
            </Box>

            {/* Suggestions Table */}
            {filteredSuggestions.length === 0 ? (
                <Alert severity="info">
                    {t('suggestion.emptyFilters')}
                </Alert>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('common.content')}</TableCell>
                                <TableCell>{t('suggestion.suggestedBy')}</TableCell>
                                <TableCell>{t('suggestion.messageForMods')}</TableCell>
                                <TableCell>{t('common.status')}</TableCell>
                                <TableCell>{t('suggestion.date')}</TableCell>
                                <TableCell align="right">{t('common.actions')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredSuggestions.map((suggestion) => (
                                <TableRow key={suggestion.id}>
                                    <TableCell>
                                        {(() => {
                                            const viewUrl = getContentOpenInNewTabUrl(suggestion.content);
                                            const title = suggestion.content?.original_title || t('common.untitled');
                                            if (!viewUrl) {
                                                return (
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {title}
                                                    </Typography>
                                                );
                                            }
                                            return (
                                                <Link
                                                    href={viewUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    variant="body2"
                                                    fontWeight="medium"
                                                    sx={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 0.5,
                                                        maxWidth: '100%',
                                                    }}
                                                >
                                                    <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {title}
                                                    </Box>
                                                    <OpenInNewIcon sx={{ fontSize: 14, flexShrink: 0 }} aria-hidden />
                                                </Link>
                                            );
                                        })()}
                                        {suggestion.is_duplicate && (
                                            <Chip 
                                                label={t('suggestion.duplicate')} 
                                                size="small" 
                                                color="warning" 
                                                sx={{ mt: 0.5 }}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {suggestion.suggested_by?.username || t('common.unknownUser')}
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                                            {suggestion.message || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        {getStatusChip(suggestion.status)}
                                    </TableCell>
                                    <TableCell>
                                        {suggestion.created_at ? new Date(suggestion.created_at).toLocaleDateString(intl) : '-'}
                                    </TableCell>
                                    <TableCell align="right">
                                        {suggestion.status === 'PENDING' && (
                                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                                <Tooltip title={t('common.accept')}>
                                                    <IconButton
                                                        color="success"
                                                        size="small"
                                                        onClick={() => handleAccept(suggestion)}
                                                        disabled={processingIds.has(suggestion.id)}
                                                    >
                                                        <CheckCircleIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title={t('common.reject')}>
                                                    <IconButton
                                                        color="error"
                                                        size="small"
                                                        onClick={() => handleRejectClick(suggestion)}
                                                        disabled={processingIds.has(suggestion.id)}
                                                    >
                                                        <CancelIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        )}
                                        {suggestion.status === 'REJECTED' && suggestion.rejection_reason && (
                                            <Tooltip title={suggestion.rejection_reason}>
                                                <Typography variant="caption" color="text.secondary">
                                                    {t('suggestion.viewReason')}
                                                </Typography>
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Reject Dialog */}
            <Dialog
                open={rejectDialogOpen}
                onClose={() => !isRejectSubmitting && setRejectDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <Box component="form" onSubmit={handleRejectSubmit(onRejectSubmit)} noValidate>
                    <DialogTitle>{t('suggestion.rejectDialogTitle')}</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {t('suggestion.rejectHelp')}
                        </Typography>
                        {rejectGeneralError && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {rejectGeneralError}
                            </Alert>
                        )}
                        <TextField
                            fullWidth
                            multiline
                            rows={4}
                            label={t('suggestion.rejectReasonLabel')}
                            placeholder={t('suggestion.rejectPlaceholder')}
                            error={!!rejectErrors.reason}
                            helperText={rejectErrors.reason?.message}
                            disabled={isRejectSubmitting || processingIds.has(selectedSuggestion?.id)}
                            {...registerReject('reason')}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={() => setRejectDialogOpen(false)}
                            disabled={isRejectSubmitting || processingIds.has(selectedSuggestion?.id)}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            color="error"
                            disabled={isRejectSubmitting || processingIds.has(selectedSuggestion?.id)}
                        >
                            {isRejectSubmitting ? t('suggestion.rejecting') : t('common.reject')}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Box>
    );
};

export default ContentSuggestionsManager;
