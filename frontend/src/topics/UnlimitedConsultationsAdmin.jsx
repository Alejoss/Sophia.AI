import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';

const UnlimitedConsultationsAdmin = () => {
  const { t } = useTranslation('topics');
  const [entries, setEntries] = useState([]);
  const [defaultLimit, setDefaultLimit] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userIdInput, setUserIdInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const data = await contentApi.getUnlimitedConsultationUsers();
      setEntries(Array.isArray(data?.results) ? data.results : []);
      if (data?.daily_default_limit != null) {
        setDefaultLimit(data.daily_default_limit);
      }
      setError(null);
    } catch (err) {
      setError(
        err?.response?.data?.error
        || t('unlimited.loadError'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleAdd = async (event) => {
    event.preventDefault();
    const userId = Number.parseInt(String(userIdInput).trim(), 10);
    if (!Number.isFinite(userId) || userId <= 0) {
      setError(t('unlimited.invalidId'));
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await contentApi.addUnlimitedConsultationUser({
        user_id: userId,
        note: noteInput.trim() || undefined,
      });
      setEntries((prev) => [created, ...prev.filter((item) => item.user_id !== created.user_id)]);
      setUserIdInput('');
      setNoteInput('');
      setSuccess(t('unlimited.added', { id: created.user_id, username: created.username }));
    } catch (err) {
      setError(
        err?.response?.data?.error
        || t('unlimited.addError'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (userId) => {
    setRemovingId(userId);
    setError(null);
    setSuccess(null);
    try {
      await contentApi.removeUnlimitedConsultationUser(userId);
      setEntries((prev) => prev.filter((item) => item.user_id !== userId));
      setSuccess(t('unlimited.removed', { id: userId }));
    } catch (err) {
      setError(
        err?.response?.data?.error
        || t('unlimited.removeError'),
      );
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Box sx={{ mb: 6 }}>
      <Typography variant="h5" gutterBottom>
        {t('unlimited.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('unlimited.introBefore', { limit: defaultLimit })}
      </Typography>

      <Paper
        component="form"
        variant="outlined"
        onSubmit={handleAdd}
        noValidate
        sx={{ p: 2, mb: 2 }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        >
          <TextField
            label={t('unlimited.userId')}
            value={userIdInput}
            onChange={(event) => setUserIdInput(event.target.value)}
            size="small"
            required
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 1 }}
            sx={{ width: { xs: '100%', sm: 140 } }}
          />
          <TextField
            label={t('unlimited.note')}
            value={noteInput}
            onChange={(event) => setNoteInput(event.target.value)}
            size="small"
            fullWidth
            placeholder={t('unlimited.notePlaceholder')}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !userIdInput.trim()}
            sx={{ whiteSpace: 'nowrap', minWidth: 120 }}
          >
            {submitting ? t('unlimited.adding') : t('unlimited.add')}
          </Button>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      ) : entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('unlimited.empty')}
        </Typography>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('unlimited.userId')}</TableCell>
                <TableCell>{t('unlimited.username')}</TableCell>
                <TableCell>{t('unlimited.noteColumn')}</TableCell>
                <TableCell>{t('unlimited.addedBy')}</TableCell>
                <TableCell align="right">{t('unlimited.remove')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.user_id} hover>
                  <TableCell>{entry.user_id}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {entry.username || '—'}
                    </Typography>
                    {entry.email && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {entry.email}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{entry.note || '—'}</TableCell>
                  <TableCell>{entry.added_by_username || '—'}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('unlimited.removeAria', { id: entry.user_id })}
                      disabled={removingId === entry.user_id}
                      onClick={() => handleRemove(entry.user_id)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
};

export default UnlimitedConsultationsAdmin;
