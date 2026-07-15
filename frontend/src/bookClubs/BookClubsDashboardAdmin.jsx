import React, { useCallback, useEffect, useState } from 'react';
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
import { extractApiError, STATUS_LABELS } from './clubTheme';

const STATUS_COLORS = {
  draft: 'default',
  active: 'success',
  closed: 'warning',
};

const BookClubsDashboardAdmin = () => {
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
      setError(extractApiError(err, 'No se pudieron cargar los clubs.'));
    } finally {
      setLoading(false);
    }
  }, []);

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
            Clubs de lectura
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Crea y gestiona book clubs. La edición se hace en subpáginas: general, conexiones,
            reuniones y preguntas.
          </Typography>
        </Box>
        <Button variant="contained" component={RouterLink} to="/dashboard/book-clubs/nuevo">
          Nuevo club
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {clubs.length === 0 ? (
        <Typography color="text.secondary">Todavía no hay clubs de lectura.</Typography>
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
                    label={STATUS_LABELS[club.status] || club.status}
                    color={STATUS_COLORS[club.status] || 'default'}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  /{club.slug}
                  {club.knowledge_path_title
                    ? ` · Path: ${club.knowledge_path_title}`
                    : ' · Sin path'}
                  {` · ${club.member_count ?? 0} miembros`}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexShrink={0}>
                <Button
                  size="small"
                  variant="contained"
                  component={RouterLink}
                  to={`/dashboard/book-clubs/${club.slug}/general`}
                >
                  Editar
                </Button>
                <Button size="small" component={RouterLink} to={`/club-de-lectura/${club.slug}`}>
                  Ver club
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
