import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import bookClubsApi from '../../api/bookClubsApi';
import { extractApiError, formatClubDate } from '../clubTheme';

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'admin', label: 'Admin' },
];

const BookClubAdminMembers = () => {
  const { slug } = useParams();
  const { reload } = useOutletContext();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

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

  const handleRoleChange = async (membershipId, role) => {
    setUpdatingId(membershipId);
    setError(null);
    setSuccess(null);
    try {
      await bookClubsApi.updateMemberRole(slug, membershipId, role);
      setSuccess('Rol actualizado.');
      await load();
      await reload?.({ silent: true });
    } catch (err) {
      setError(extractApiError(err, 'No se pudo cambiar el rol.'));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Miembros del club
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        Lista completa para administración. En la pestaña Comunidad del club público solo se muestran
        quienes completaron «Preséntate» (bio del perfil).
      </Typography>

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
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 2,
                justifyContent: 'space-between',
                alignItems: { sm: 'center' },
              }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
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
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel id={`role-${m.id}`}>Rol</InputLabel>
                <Select
                  labelId={`role-${m.id}`}
                  label="Rol"
                  value={m.role}
                  disabled={updatingId === m.id}
                  onChange={(e) => handleRoleChange(m.id, e.target.value)}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default BookClubAdminMembers;
