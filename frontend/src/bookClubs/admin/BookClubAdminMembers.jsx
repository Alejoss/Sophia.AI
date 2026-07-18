import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import bookClubsApi from '../../api/bookClubsApi';
import { extractApiError, formatClubDate } from '../clubTheme';

const BookClubAdminMembers = () => {
  const { slug } = useParams();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bookClubsApi.listMembers(slug, { includeAll: true });
      setMembers(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(extractApiError(err, 'No se pudieron cargar los miembros.'));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Miembros del club
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        Lista completa para administración. La gestión del club (foro, reuniones, contenido) la
        tienen los usuarios staff de la plataforma; no hace falta asignar roles dentro del club. En
        Comunidad solo se muestran quienes completaron «Preséntate».
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : !members.length ? (
        <Typography color="text.secondary">Aún no hay miembros en este club.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {members.map((m) => (
            <Box
              key={m.id}
              sx={{
                py: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Typography fontWeight={700}>
                @{m.username}
                {m.is_me ? ' · Tú' : ''}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  color={m.has_introduced ? 'success' : 'default'}
                  label={m.has_introduced ? 'Presentado' : 'Sin presentación'}
                />
                <Typography variant="caption" color="text.secondary">
                  Desde {formatClubDate(m.joined_at) || '—'}
                </Typography>
              </Stack>
              {m.intro_description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}
                >
                  {m.intro_description}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default BookClubAdminMembers;
