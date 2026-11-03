import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  downloadNewsletterSubscribers,
  fetchNewsletterSubscribers,
  updateNewsletterSubscriber,
} from '../api/profilesApi';
import { useDateLocales } from '../hooks/useDateLocales';

const formatWhen = (value, intl) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(intl, { dateStyle: 'medium', timeStyle: 'short' });
};

const NewsletterSubscribersDashboard = () => {
  const { t } = useTranslation('newsletter');
  const { intl } = useDateLocales();
  const [status, setStatus] = useState('active');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await fetchNewsletterSubscribers({ status, q: query, page });
      setData(payload);
    } catch {
      setError(t('dashboard.loadError'));
    } finally {
      setLoading(false);
    }
  }, [page, query, status, t]);

  useEffect(() => {
    load();
  }, [load]);

  const applySearch = (event) => {
    event.preventDefault();
    setPage(1);
    setQuery(searchInput.trim());
  };

  const copyLink = async (row) => {
    try {
      await navigator.clipboard.writeText(row.unsubscribe_url);
      setCopiedId(row.id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === row.id ? null : current));
      }, 2000);
    } catch {
      setError(t('dashboard.copyError'));
    }
  };

  const downloadCsv = async () => {
    try {
      const blob = await downloadNewsletterSubscribers({ status, q: query });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'newsletter-suscriptores.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('dashboard.downloadError'));
    }
  };

  const confirmChange = async () => {
    if (!pending) return;
    setSaving(true);
    setError('');
    try {
      await updateNewsletterSubscriber(pending.row.id, pending.nextActive);
      setPending(null);
      await load();
    } catch {
      setError(t('dashboard.updateError'));
    } finally {
      setSaving(false);
    }
  };

  const rows = data?.results || [];
  const count = data?.count || 0;

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" gutterBottom>
            {t('dashboard.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dashboard.intro')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip size="small" color="success" label={t('dashboard.activeCount', { count: data?.active_count ?? 0 })} />
          <Chip size="small" label={t('dashboard.inactiveCount', { count: data?.inactive_count ?? 0 })} />
        </Stack>
      </Stack>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={status}
          onChange={(_event, value) => {
            if (!value) return;
            setStatus(value);
            setPage(1);
          }}
        >
          <ToggleButton value="active">{t('dashboard.filterActive')}</ToggleButton>
          <ToggleButton value="inactive">{t('dashboard.filterInactive')}</ToggleButton>
          <ToggleButton value="all">{t('dashboard.filterAll')}</ToggleButton>
        </ToggleButtonGroup>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} component="form" onSubmit={applySearch}>
          <TextField
            size="small"
            label={t('dashboard.search')}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <Button type="submit" variant="outlined">
            {t('dashboard.searchAction')}
          </Button>
          <Button variant="outlined" onClick={downloadCsv}>
            {t('dashboard.download')}
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('dashboard.empty')}
        </Typography>
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('dashboard.email')}</TableCell>
                  <TableCell>{t('dashboard.status')}</TableCell>
                  <TableCell>{t('dashboard.source')}</TableCell>
                  <TableCell>{t('dashboard.subscribedAt')}</TableCell>
                  <TableCell>{t('dashboard.unsubscribedAt')}</TableCell>
                  <TableCell align="right">{t('dashboard.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={row.is_active ? 'success' : 'default'}
                        label={row.is_active ? t('dashboard.active') : t('dashboard.inactive')}
                      />
                    </TableCell>
                    <TableCell>{row.source_label}</TableCell>
                    <TableCell>{formatWhen(row.created_at, intl)}</TableCell>
                    <TableCell>{formatWhen(row.unsubscribed_at, intl)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" onClick={() => copyLink(row)}>
                          {copiedId === row.id ? t('dashboard.copied') : t('dashboard.copyLink')}
                        </Button>
                        <Button
                          size="small"
                          color={row.is_active ? 'warning' : 'primary'}
                          onClick={() => setPending({ row, nextActive: !row.is_active })}
                        >
                          {row.is_active ? t('dashboard.deactivate') : t('dashboard.reactivate')}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={count}
            page={Math.max(page - 1, 0)}
            onPageChange={(_event, nextPage) => setPage(nextPage + 1)}
            rowsPerPage={25}
            rowsPerPageOptions={[25]}
            labelRowsPerPage={t('dashboard.rowsPerPage')}
            labelDisplayedRows={({ from, to, count: total }) => t('dashboard.displayedRows', {
              from,
              to,
              count: total,
            })}
          />
        </Paper>
      )}

      <Dialog open={Boolean(pending)} onClose={() => !saving && setPending(null)}>
        <DialogTitle>
          {pending?.nextActive
            ? t('dashboard.confirmReactivateTitle')
            : t('dashboard.confirmDeactivateTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pending?.nextActive
              ? t('dashboard.confirmReactivate', { email: pending.row.email })
              : t('dashboard.confirmDeactivate', { email: pending?.row.email })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)} disabled={saving}>
            {t('dashboard.cancel')}
          </Button>
          <Button onClick={confirmChange} disabled={saving} variant="contained">
            {t('dashboard.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NewsletterSubscribersDashboard;
