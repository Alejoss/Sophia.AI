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
import bookClubsApi from '../../api/bookClubsApi';
import { extractApiError, STATUS_LABELS } from '../clubTheme';

const BookClubAdminLayout = () => {
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
      setError(extractApiError(err, 'No se pudo cargar el club.'));
      if (!silent) setClub(null);
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [slug]);

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
          ← Dashboard
        </Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button component={RouterLink} to="/dashboard" sx={{ mb: 2 }}>
        ← Clubs de lectura
      </Button>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        <Typography variant="h4" component="h1">
          {club.title}
        </Typography>
        <Chip size="small" label={STATUS_LABELS[club.status] || club.status} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        /{club.slug} · Edita el club por secciones
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
          General
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
          Conexiones
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
          Misiones
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
          Reuniones
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
          Foro
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
          Miembros
        </Box>
        <Button
          size="small"
          component={RouterLink}
          to={`/club-de-lectura/${club.slug}`}
          sx={{ ml: 'auto', alignSelf: 'center' }}
        >
          Ver club público
        </Button>
      </Stack>

      <Outlet context={{ club, reload, setError }} />
    </Box>
  );
};

export default BookClubAdminLayout;
