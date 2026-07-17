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
  normalizeTelegramUrl,
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
    telegram_group_url: '',
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
        telegram_group_url: club.telegram_group_url || '',
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
        telegram_group_url: normalizeTelegramUrl(form.telegram_group_url),
      };
      // Only send dates when filled. Empty fields omit the key so a partial
      // save (e.g. editing Telegram) cannot wipe existing starts_at/ends_at.
      if (form.starts_at) {
        const iso = toIsoOrNull(form.starts_at);
        if (!iso) {
          setError('La fecha de inicio no es válida.');
          setSaving(false);
          return;
        }
        payload.starts_at = iso;
      }
      if (form.ends_at) {
        const iso = toIsoOrNull(form.ends_at);
        if (!iso) {
          setError('La fecha de fin no es válida.');
          setSaving(false);
          return;
        }
        payload.ends_at = iso;
      }
      if (form.cover_image instanceof File) {
        payload.cover_image = form.cover_image;
      }
      if (isCreate) {
        const created = await bookClubsApi.createClub(payload);
        navigate(`/dashboard/book-clubs/${created.slug}/conexiones`, { replace: true });
      } else {
        const updated = await bookClubsApi.updateClub(slug, payload);
        setForm({
          title: updated.title || '',
          description: updated.description || '',
          status: updated.status || 'draft',
          starts_at: toDatetimeLocal(updated.starts_at),
          ends_at: toDatetimeLocal(updated.ends_at),
          telegram_group_url: updated.telegram_group_url || '',
          cover_image: null,
        });
        setSuccess('Cambios guardados.');
        await reload?.({ silent: true });
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
        <TextField
          label="Link del grupo de Telegram"
          fullWidth
          placeholder="https://t.me/tu-grupo"
          value={form.telegram_group_url}
          onChange={handleField('telegram_group_url')}
          helperText="Acepta https://t.me/..., t.me/... o @usuario. Se muestra en Comunidad e Inicio."
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
          label="Inicio del ciclo"
          type="datetime-local"
          fullWidth
          InputLabelProps={{ shrink: true }}
          value={form.starts_at}
          onChange={handleField('starts_at')}
          helperText="Se muestra en el hub del club (semana / fase del ciclo)."
        />
        <TextField
          label="Fin del ciclo"
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
