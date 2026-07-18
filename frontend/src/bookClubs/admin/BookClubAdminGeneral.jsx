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
  const [clearCover, setClearCover] = useState(false);
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
      setClearCover(false);
    }
  }, [isCreate, club]);

  const handleField = (field) => (event) => {
    if (field === 'cover_image') {
      const file = event.target.files?.[0] || null;
      setForm((prev) => ({ ...prev, cover_image: file }));
      if (file) setClearCover(false);
      return;
    }
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
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
      let startsAt = null;
      let endsAt = null;
      if (form.starts_at) {
        startsAt = toIsoOrNull(form.starts_at);
        if (!startsAt) {
          setError('La fecha de inicio no es válida.');
          setSaving(false);
          return;
        }
      }
      if (form.ends_at) {
        endsAt = toIsoOrNull(form.ends_at);
        if (!endsAt) {
          setError('La fecha de fin no es válida.');
          setSaving(false);
          return;
        }
      }

      const payload = {
        title: form.title.trim(),
        description: form.description,
        status: form.status,
        telegram_group_url: normalizeTelegramUrl(form.telegram_group_url) || '',
      };

      // On edit, always send dates (ISO or null) so clearing the inputs works.
      // On create, only send when filled.
      if (!isCreate || form.starts_at) payload.starts_at = startsAt;
      if (!isCreate || form.ends_at) payload.ends_at = endsAt;

      if (form.cover_image instanceof File) {
        payload.cover_image = form.cover_image;
      } else if (!isCreate && clearCover) {
        payload.cover_image = null;
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
        setClearCover(false);
        setSuccess('Cambios guardados.');
        await reload?.({ silent: true });
      }
    } catch (err) {
      setError(extractApiError(err, 'No se pudo guardar.'));
    } finally {
      setSaving(false);
    }
  };

  const coverPreview =
    !clearCover && !form.cover_image && club?.cover_image ? club.cover_image : null;

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
            Empieza con lo esencial. Luego, en Conexiones, vinculas el knowledge path (misiones) y
            el tema de Investigación; después reuniones y preguntas.
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
          helperText="Acepta https://t.me/..., t.me/... o @usuario. Déjalo vacío para quitarlo."
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
          helperText="Se muestra en el hub. Vacía el campo y guarda para quitar la fecha."
        />
        <TextField
          label="Fin del ciclo"
          type="datetime-local"
          fullWidth
          InputLabelProps={{ shrink: true }}
          value={form.ends_at}
          onChange={handleField('ends_at')}
        />

        {(coverPreview || form.cover_image) && (
          <Box>
            {coverPreview && (
              <Box
                component="img"
                src={coverPreview}
                alt="Portada actual"
                sx={{ maxWidth: 280, maxHeight: 160, objectFit: 'cover', display: 'block', mb: 1 }}
              />
            )}
            {form.cover_image && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Nueva: {form.cover_image.name}
              </Typography>
            )}
          </Box>
        )}

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" component="label">
            {form.cover_image ? 'Cambiar archivo' : coverPreview ? 'Reemplazar portada' : 'Portada (opcional)'}
            <input hidden type="file" accept="image/*" onChange={handleField('cover_image')} />
          </Button>
          {!isCreate && (coverPreview || form.cover_image || club?.cover_image) && (
            <Button
              variant="text"
              color="error"
              onClick={() => {
                setForm((prev) => ({ ...prev, cover_image: null }));
                setClearCover(true);
              }}
            >
              Quitar portada
            </Button>
          )}
        </Stack>

        <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ alignSelf: 'flex-start' }}>
          {saving ? 'Guardando…' : isCreate ? 'Crear y continuar' : 'Guardar cambios'}
        </Button>
      </Stack>
    </Box>
  );
};

export default BookClubAdminGeneral;
