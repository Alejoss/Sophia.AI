import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useTranslation } from 'react-i18next';
import contentApi from '../../api/contentApi';
import { useDateLocales } from '../../hooks/useDateLocales';
import i18n from '../../i18n';
import { applyApiErrorsToForm } from '../../utils/apiFormErrors.js';

const rejectSchema = yup.object({
  reason: yup
    .string()
    .trim()
    .required(() => i18n.t('topics:timeline.rejectReasonRequired')),
});

const formatDate = (value, locale) => {
  if (!value) return null;
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

const TimelineEntrySuggestionsManager = ({ topicId, onSuggestionProcessed }) => {
  const { t } = useTranslation('topics');
  const { intl } = useDateLocales();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('PENDING');
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
      const data = await contentApi.getTopicTimelineEntrySuggestions(topicId, filters);
      setSuggestions(Array.isArray(data) ? data : []);
      setError(null);
    } catch {
      setError(t('timeline.loadSuggestionsError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [topicId, filterStatus, t]);

  const handleAccept = async (suggestion) => {
    setProcessingIds((prev) => new Set(prev).add(suggestion.id));
    setError(null);
    try {
      await contentApi.acceptTopicTimelineEntrySuggestion(topicId, suggestion.id);
      await fetchSuggestions();
      onSuggestionProcessed?.();
    } catch (err) {
      setError(err.response?.data?.error || t('suggestion.acceptError'));
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(suggestion.id);
        return next;
      });
    }
  };

  const onRejectSubmit = async ({ reason }) => {
    if (!selectedSuggestion) return;

    const suggestionId = selectedSuggestion.id;
    setProcessingIds((prev) => new Set(prev).add(suggestionId));
    setRejectGeneralError('');
    setError(null);
    try {
      await contentApi.rejectTopicTimelineEntrySuggestion(
        topicId,
        suggestionId,
        reason,
      );
      setRejectDialogOpen(false);
      setSelectedSuggestion(null);
      resetRejectForm({ reason: '' });
      await fetchSuggestions();
      onSuggestionProcessed?.();
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
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(suggestionId);
        return next;
      });
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('user.timelineSuggestionsTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t('timeline.reviewIntro')}
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        {t('timeline.acceptInfo')}
      </Alert>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>{t('common.status')}</InputLabel>
          <Select
            value={filterStatus}
            label={t('common.status')}
            onChange={(event) => setFilterStatus(event.target.value)}
          >
            <MenuItem value="all">{t('common.all')}</MenuItem>
            <MenuItem value="PENDING">{t('suggestion.statusPendingPlural')}</MenuItem>
            <MenuItem value="ACCEPTED">{t('suggestion.statusAcceptedPlural')}</MenuItem>
            <MenuItem value="REJECTED">{t('suggestion.statusRejectedPlural')}</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : suggestions.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('timeline.emptySuggestions')}</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('edit.titleLabel')}</TableCell>
                <TableCell>{t('timeline.dates')}</TableCell>
                <TableCell>{t('suggestion.suggestedBy')}</TableCell>
                <TableCell>{t('timeline.contents')}</TableCell>
                <TableCell>{t('common.status')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {suggestions.map((suggestion) => {
                const isProcessing = processingIds.has(suggestion.id);
                const formatDateLabel = (value) => formatDate(value, intl) || t('common.noDate');
                const dateLabel = suggestion.end_date
                  ? `${formatDateLabel(suggestion.start_date)} - ${formatDateLabel(suggestion.end_date)}`
                  : formatDateLabel(suggestion.start_date);
                return (
                  <TableRow key={suggestion.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {suggestion.title}
                      </Typography>
                      {suggestion.description && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {suggestion.description.slice(0, 120)}
                          {suggestion.description.length > 120 ? '...' : ''}
                        </Typography>
                      )}
                      {suggestion.message && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          {t('timeline.messageForMods', { message: suggestion.message })}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{dateLabel}</TableCell>
                    <TableCell>{suggestion.suggested_by?.username || '-'}</TableCell>
                    <TableCell>
                      {(suggestion.contents || []).length === 0 ? (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      ) : (
                        (suggestion.contents || []).map((item) => {
                          const title = item.content?.original_title || t('common.untitledPlain');
                          return (
                            <Box key={item.id} sx={{ mb: 0.5 }}>
                              <Typography variant="body2" component="span">
                                {title}
                              </Typography>
                              {suggestion.status === 'PENDING' && (
                                <Chip
                                  size="small"
                                  label={item.is_in_topic ? t('timeline.alreadyInTopic') : t('timeline.willAddToTopic')}
                                  color={item.is_in_topic ? 'default' : 'primary'}
                                  variant="outlined"
                                  sx={{ ml: 1, verticalAlign: 'middle' }}
                                />
                              )}
                            </Box>
                          );
                        })
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={suggestion.status}
                        color={
                          suggestion.status === 'ACCEPTED'
                            ? 'success'
                            : suggestion.status === 'REJECTED'
                              ? 'error'
                              : 'warning'
                        }
                      />
                      {suggestion.is_duplicate && (
                        <Chip size="small" label={t('suggestion.duplicate')} color="warning" sx={{ ml: 0.5 }} />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {suggestion.status === 'PENDING' && (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title={t('timeline.publishTooltip')}>
                            <span>
                              <Button
                                size="small"
                                color="success"
                                startIcon={<CheckCircleIcon />}
                                disabled={isProcessing}
                                onClick={() => handleAccept(suggestion)}
                              >
                                {t('common.accept')}
                              </Button>
                            </span>
                          </Tooltip>
                          <Tooltip title={t('common.reject')}>
                            <span>
                              <Button
                                size="small"
                                color="error"
                                startIcon={<CancelIcon />}
                                disabled={isProcessing}
                                onClick={() => {
                                  setSelectedSuggestion(suggestion);
                                  resetRejectForm({ reason: '' });
                                  setRejectGeneralError('');
                                  setRejectDialogOpen(true);
                                }}
                              >
                                {t('common.reject')}
                              </Button>
                            </span>
                          </Tooltip>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={rejectDialogOpen}
        onClose={() => !isRejectSubmitting && setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <Box component="form" onSubmit={handleRejectSubmit(onRejectSubmit)} noValidate>
          <DialogTitle>{t('timeline.rejectTimelineTitle')}</DialogTitle>
          <DialogContent>
            {rejectGeneralError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {rejectGeneralError}
              </Alert>
            )}
            <TextField
              fullWidth
              multiline
              minRows={3}
              label={t('timeline.rejectReasonLabel')}
              error={!!rejectErrors.reason}
              helperText={rejectErrors.reason?.message}
              disabled={isRejectSubmitting}
              sx={{ mt: 1 }}
              {...registerReject('reason')}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRejectDialogOpen(false)} disabled={isRejectSubmitting}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              color="error"
              variant="contained"
              disabled={isRejectSubmitting}
            >
              {isRejectSubmitting ? t('suggestion.rejecting') : t('common.reject')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};

export default TimelineEntrySuggestionsManager;
