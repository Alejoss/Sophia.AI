import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, NavLink, Outlet, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import bookClubsApi from '../../api/bookClubsApi';
import { extractApiError } from '../clubTheme';

const BookClubAdminLayout = () => {
  const { t } = useTranslation('nav');
  const { t: tc } = useTranslation('bookClubs');
  const { slug } = useParams();
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const data = await bookClubsApi.getClub(slug);
      setClub(data);
      setError(null);
      return data;
    } catch (err) {
      setError(extractApiError(err, t('bookClub.loadError')));
      if (!silent) setClub(null);
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [slug, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !club) {
    return (
      <Box>
        <Button component={RouterLink} to="/dashboard" sx={{ mb: 2 }}>
          {tc('dashboardBack')}
        </Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button component={RouterLink} to="/dashboard" sx={{ mb: 2 }}>
        {t('bookClub.backToClubs')}
      </Button>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        <Typography variant="h4" component="h1">
          {club.title}
        </Typography>
        <Chip size="small" label={tc(`status.${club.status}`, { defaultValue: club.status })} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        /{club.slug} · {t('bookClub.editBySection')}
      </Typography>

      <Stack
        direction="row"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          mb: 3,
          overflowX: 'auto',
        }}
      >
        <Box
          component={NavLink}
          to="general"
          style={({ isActive }) => ({
            color: isActive ? 'inherit' : '#666',
            borderBottom: isActive ? '2px solid' : '2px solid transparent',
            fontWeight: isActive ? 700 : 500,
            textDecoration: 'none',
          })}
          sx={{ px: 1.5, py: 1, fontSize: '0.9rem', whiteSpace: 'nowrap', borderColor: 'primary.main' }}
        >
          {t('bookClub.general')}
        </Box>
        <Box
          component={NavLink}
          to="conexiones"
          style={({ isActive }) => ({
            color: isActive ? 'inherit' : '#666',
            borderBottom: isActive ? '2px solid' : '2px solid transparent',
            fontWeight: isActive ? 700 : 500,
            textDecoration: 'none',
          })}
          sx={{ px: 1.5, py: 1, fontSize: '0.9rem', whiteSpace: 'nowrap', borderColor: 'primary.main' }}
        >
          {t('bookClub.connections')}
        </Box>
        <Box
          component={NavLink}
          to="misiones"
          style={({ isActive }) => ({
            color: isActive ? 'inherit' : '#666',
            borderBottom: isActive ? '2px solid' : '2px solid transparent',
            fontWeight: isActive ? 700 : 500,
            textDecoration: 'none',
          })}
          sx={{ px: 1.5, py: 1, fontSize: '0.9rem', whiteSpace: 'nowrap', borderColor: 'primary.main' }}
        >
          {t('bookClub.missions')}
        </Box>
        <Box
          component={NavLink}
          to="reuniones"
          style={({ isActive }) => ({
            color: isActive ? 'inherit' : '#666',
            borderBottom: isActive ? '2px solid' : '2px solid transparent',
            fontWeight: isActive ? 700 : 500,
            textDecoration: 'none',
          })}
          sx={{ px: 1.5, py: 1, fontSize: '0.9rem', whiteSpace: 'nowrap', borderColor: 'primary.main' }}
        >
          {t('bookClub.meetings')}
        </Box>
        <Box
          component={NavLink}
          to="preguntas"
          style={({ isActive }) => ({
            color: isActive ? 'inherit' : '#666',
            borderBottom: isActive ? '2px solid' : '2px solid transparent',
            fontWeight: isActive ? 700 : 500,
            textDecoration: 'none',
          })}
          sx={{ px: 1.5, py: 1, fontSize: '0.9rem', whiteSpace: 'nowrap', borderColor: 'primary.main' }}
        >
          {t('bookClub.forum')}
        </Box>
        <Box
          component={NavLink}
          to="miembros"
          style={({ isActive }) => ({
            color: isActive ? 'inherit' : '#666',
            borderBottom: isActive ? '2px solid' : '2px solid transparent',
            fontWeight: isActive ? 700 : 500,
            textDecoration: 'none',
          })}
          sx={{ px: 1.5, py: 1, fontSize: '0.9rem', whiteSpace: 'nowrap', borderColor: 'primary.main' }}
        >
          {t('bookClub.members')}
        </Box>
        <Button
          size="small"
          component={RouterLink}
          to={`/club-de-lectura/${club.slug}`}
          sx={{ ml: 'auto', alignSelf: 'center' }}
        >
          {t('bookClub.viewPublic')}
        </Button>
      </Stack>

      <Outlet context={{ club, reload, setError }} />
    </Box>
  );
};

export default BookClubAdminLayout;
