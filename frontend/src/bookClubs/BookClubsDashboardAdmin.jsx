import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import bookClubsApi from '../api/bookClubsApi';
import { extractApiError } from './clubTheme';

const STATUS_COLORS = {
  draft: 'default',
  active: 'success',
  closed: 'warning',
};

const BookClubsDashboardAdmin = () => {
  const { t } = useTranslation('bookClubs');
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadClubs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await bookClubsApi.listClubs();
      setClubs(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(extractApiError(err, t('errors.loadClubs')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 6 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" gutterBottom>
            {t('adminList.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('adminList.intro')}
          </Typography>
        </Box>
        <Button variant="contained" component={RouterLink} to="/dashboard/book-clubs/nuevo">
          {t('adminList.new')}
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {clubs.length === 0 ? (
        <Typography color="text.secondary">{t('adminList.empty')}</Typography>
      ) : (
        <Stack spacing={1.5}>
          {clubs.map((club) => (
            <Box
              key={club.id}
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1.5,
                alignItems: { sm: 'center' },
                justifyContent: 'space-between',
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {club.title}
                  </Typography>
                  <Chip
                    size="small"
                    label={t(`status.${club.status}`, { defaultValue: club.status })}
                    color={STATUS_COLORS[club.status] || 'default'}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  /{club.slug}
                  {club.knowledge_path_title
                    ? t('adminList.withPath', { title: club.knowledge_path_title })
                    : t('adminList.noPath')}
                  {t('adminList.members', { count: club.member_count ?? 0 })}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexShrink={0}>
                <Button
                  size="small"
                  variant="contained"
                  component={RouterLink}
                  to={`/dashboard/book-clubs/${club.slug}/general`}
                >
                  {t('adminList.edit')}
                </Button>
                <Button size="small" component={RouterLink} to={`/club-de-lectura/${club.slug}`}>
                  {t('adminList.view')}
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default BookClubsDashboardAdmin;
