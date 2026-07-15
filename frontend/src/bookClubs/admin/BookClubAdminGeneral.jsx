import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import bookClubsApi from '../../api/bookClubsApi';
import {
  extractApiError,
  STATUS_LABELS,
  toDatetimeLocal,
  toIsoOrNull,
} from '../clubTheme';

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

const BookClubAdminGeneral = ({ mode = 'edit' }) => {
  const isCreate = mode === 'create';
  const { slug } = useParams();
  const navigate = useNavigate();
  const outlet = useOutletContext() || {};
  const club = outlet.club;
  const reload = outlet.reload;

  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'draft',
    starts_at: '',
    ends_at: '',
    cover_image: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!isCreate && club) {
      setForm({
        title: club.title || '',
        description: club.description || '',
        status: club.status || 'draft',
        starts_at: toDatetimeLocal(club.starts_at),
        ends_at: toDatetimeLocal(club.ends_at),
        cover_image: null,
      });
    }
  }, [isCreate, club]);

  const handleField = (field) => (event) => {
    const value = field === 'cover_image' ? event.target.files?.[0] || null : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('El título es obligatorio.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description,
        status: form.status,
        starts_at: toIsoOrNull(form.starts_at),
        ends_at: toIsoOrNull(form.ends_at),
      };
      if (form.cover_image instanceof File) {
        payload.cover_image = form.cover_image;
      }
      if (isCreate) {
        const created = await bookClubsApi.createClub(payload);
        navigate(`/dashboard/book-clubs/${created.slug}/conexiones`, { replace: true });
      } else {
        await bookClubsApi.updateClub(slug, payload);
        setSuccess('Cambios guardados.');
        await reload?.();
      }
    } catch (err) {
      setError(extractApiError(err, 'No se pudo guardar.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      {isCreate && (
        <>
          <Button component={RouterLink} to="/dashboard" sx={{ mb: 2 }}>
            ← Dashboard
          </Button>
          <Typography variant="h4" gutterBottom>
            Nuevo club de lectura
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Empieza con lo esencial. Luego podrás vincular path, topic y reuniones.
          </Typography>
        </>
      )}

      {!isCreate && (
        <Typography variant="h6" gutterBottom>
          Datos generales
        </Typography>
      )}

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

      <Stack spacing={2} maxWidth={640}>
        <TextField label="Título" required fullWidth value={form.title} onChange={handleField('title')} />
        <TextField
          label="Descripción"
          fullWidth
          multiline
          minRows={4}
          value={form.description}
          onChange={handleField('description')}
        />
        <FormControl fullWidth>
          <InputLabel id="status-label">Estado</InputLabel>
          <Select
            labelId="status-label"
            label="Estado"
            value={form.status}
            onChange={handleField('status')}
          >
            {STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Inicio"
          type="datetime-local"
          fullWidth
          InputLabelProps={{ shrink: true }}
          value={form.starts_at}
          onChange={handleField('starts_at')}
        />
        <TextField
          label="Fin"
          type="datetime-local"
          fullWidth
          InputLabelProps={{ shrink: true }}
          value={form.ends_at}
          onChange={handleField('ends_at')}
        />
        <Button variant="outlined" component="label" sx={{ alignSelf: 'flex-start' }}>
          {form.cover_image ? form.cover_image.name : 'Portada (opcional)'}
          <input hidden type="file" accept="image/*" onChange={handleField('cover_image')} />
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ alignSelf: 'flex-start' }}>
          {saving ? 'Guardando…' : isCreate ? 'Crear y continuar' : 'Guardar cambios'}
        </Button>
      </Stack>
    </Box>
  );
};

export default BookClubAdminGeneral;
