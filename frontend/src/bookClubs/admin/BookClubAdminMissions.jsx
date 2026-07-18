import React, { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LockClockIcon from '@mui/icons-material/LockClock';
import bookClubsApi from '../../api/bookClubsApi';
import { extractApiError, toDatetimeLocal, toIsoOrNull } from '../clubTheme';

const BookClubAdminMissions = () => {
  const { slug } = useParams();
  const { club } = useOutletContext();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    bookClubsApi
      .getMissionSchedule(slug)
      .then((data) => {
        if (!cancelled) {
          setMissions(
            data.map((mission) => ({
              ...mission,
              localOpensAt: toDatetimeLocal(mission.opens_at),
            }))
          );
          setError('');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(extractApiError(err, 'No se pudo cargar el calendario.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const updateDate = (nodeId, value) => {
    setMissions((current) =>
      current.map((mission) =>
        mission.node_id === nodeId ? { ...mission, localOpensAt: value } : mission
      )
    );
    setSuccess('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await bookClubsApi.updateMissionSchedule(
        slug,
        missions.map((mission) => ({
          node_id: mission.node_id,
          opens_at: toIsoOrNull(mission.localOpensAt),
        }))
      );
      setMissions(
        data.map((mission) => ({
          ...mission,
          localOpensAt: toDatetimeLocal(mission.opens_at),
        }))
      );
      setSuccess('Calendario guardado. La disponibilidad se actualiza para todo el club.');
    } catch (err) {
      setError(extractApiError(err, 'No se pudo guardar el calendario.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Calendario de misiones
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 720 }}>
          Define cuándo se abre cada lectura para todos los miembros. Además de llegar la fecha,
          cada persona debe haber completado la misión anterior.
        </Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {!club.knowledge_path ? (
        <Alert severity="info">
          Vincula primero un camino del conocimiento desde la sección Conexiones.
        </Alert>
      ) : missions.length === 0 ? (
        <Alert severity="info">
          El camino vinculado todavía no tiene nodos.
        </Alert>
      ) : (
        <Stack spacing={2}>
          {missions.map((mission) => (
            <Box
              key={mission.node_id}
              sx={{
                p: 2.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ xs: 'stretch', sm: 'center' }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="overline" color="text.secondary">
                    Misión {mission.order}
                  </Typography>
                  <Typography sx={{ fontWeight: 700 }}>{mission.title}</Typography>
                </Box>
                <Chip
                  icon={<LockClockIcon />}
                  label={mission.is_released ? 'Disponible' : 'Bloqueada'}
                  color={mission.is_released ? 'success' : 'warning'}
                  variant="outlined"
                />
                <TextField
                  type="datetime-local"
                  label="Se desbloquea"
                  value={mission.localOpensAt}
                  onChange={(event) => updateDate(mission.node_id, event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: { sm: 250 } }}
                />
              </Stack>
            </Box>
          ))}

          <Button
            variant="contained"
            onClick={save}
            disabled={saving}
            sx={{ alignSelf: 'flex-start' }}
          >
            {saving ? 'Guardando…' : 'Guardar calendario'}
          </Button>
        </Stack>
      )}
    </Stack>
  );
};

export default BookClubAdminMissions;
