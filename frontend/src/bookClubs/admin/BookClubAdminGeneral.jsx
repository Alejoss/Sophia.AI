import React, { useEffect, useRef, useState } from 'react';
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
import { resolveMediaUrl } from '../../utils/fileUtils';
import {
  extractApiError,
  normalizeTelegramUrl,
  STATUS_LABELS,
  toDatetimeLocal,
  toIsoOrNull,
} from '../clubTheme';

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
const MAX_COVER_BYTES = 3 * 1024 * 1024;

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
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const localPreviewRef = useRef(null);

  const revokeLocalPreview = () => {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }
  };

  // Sync server fields without wiping a pending local File selection.
  useEffect(() => {
    if (isCreate || !club) return undefined;
    setForm((prev) => ({
      title: club.title || '',
      description: club.description || '',
      status: club.status || 'draft',
      starts_at: toDatetimeLocal(club.starts_at),
      ends_at: toDatetimeLocal(club.ends_at),
      telegram_group_url: club.telegram_group_url || '',
      cover_image: prev.cover_image instanceof File ? prev.cover_image : null,
    }));
    return undefined;
  }, [
    isCreate,
    club?.id,
    club?.updated_at,
    club?.title,
    club?.description,
    club?.status,
    club?.starts_at,
    club?.ends_at,
    club?.telegram_group_url,
    club?.cover_image,
  ]);

  useEffect(() => () => revokeLocalPreview(), []);

  const handleField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleCoverSelect = async (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen (JPEG, PNG, GIF o WebP).');
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setError('La portada no debe superar 3 MB.');
      return;
    }

    setError(null);
    setSuccess(null);
    setClearCover(false);
    revokeLocalPreview();
    const localUrl = URL.createObjectURL(file);
    localPreviewRef.current = localUrl;
    setCoverPreviewUrl(localUrl);
    setForm((prev) => ({ ...prev, cover_image: file }));

    // Edit mode: upload immediately (same pattern as KnowledgePathEdit cover).
    if (!isCreate && slug) {
      setUploadingCover(true);
      try {
        const updated = await bookClubsApi.updateClub(slug, { cover_image: file });
        setForm((prev) => ({ ...prev, cover_image: null }));
        revokeLocalPreview();
        setCoverPreviewUrl(null);
        setSuccess('Portada actualizada.');
        await reload?.({ silent: true });
        if (updated?.cover_image) {
          setCoverPreviewUrl(resolveMediaUrl(updated.cover_image));
        }
      } catch (err) {
        const coverErr = err?.response?.data?.cover_image;
        const coverMsg = Array.isArray(coverErr) ? coverErr.join(' ') : coverErr;
        setError(coverMsg || extractApiError(err, 'No se pudo subir la portada.'));
      } finally {
        setUploadingCover(false);
      }
    }
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

      // Create: include pending cover. Edit: cover uploads on select; only send clear.
      if (isCreate && form.cover_image instanceof File) {
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
        revokeLocalPreview();
        setCoverPreviewUrl(null);
        setSuccess('Cambios guardados.');
        await reload?.({ silent: true });
      }
    } catch (err) {
      const coverErr = err?.response?.data?.cover_image;
      const coverMsg = Array.isArray(coverErr) ? coverErr.join(' ') : coverErr;
      setError(coverMsg || extractApiError(err, 'No se pudo guardar.'));
    } finally {
      setSaving(false);
    }
  };

  const serverCover = club?.cover_image ? resolveMediaUrl(club.cover_image) : null;
  const displayCover = clearCover ? null : coverPreviewUrl || serverCover;

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

        {displayCover && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {form.cover_image instanceof File
                ? `Nueva: ${form.cover_image.name}`
                : coverPreviewUrl && !serverCover
                  ? 'Vista previa'
                  : 'Portada actual'}
            </Typography>
            <Box
              component="img"
              src={displayCover}
              alt="Portada del club"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              sx={{ maxWidth: 280, maxHeight: 160, objectFit: 'cover', display: 'block', mb: 1 }}
            />
          </Box>
        )}

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <Button variant="outlined" component="label" disabled={uploadingCover || saving}>
            {uploadingCover
              ? 'Subiendo portada…'
              : form.cover_image
                ? 'Cambiar archivo'
                : displayCover
                  ? 'Reemplazar portada'
                  : 'Portada (opcional)'}
            <input hidden type="file" accept="image/*" onChange={handleCoverSelect} />
          </Button>
          {!isCreate && (displayCover || club?.cover_image || clearCover) && (
            <Button
              variant="text"
              color="error"
              disabled={uploadingCover || saving}
              onClick={() => {
                setForm((prev) => ({ ...prev, cover_image: null }));
                setClearCover(true);
                revokeLocalPreview();
                setCoverPreviewUrl(null);
              }}
            >
              Quitar portada
            </Button>
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {isCreate
            ? 'La portada se envía al crear el club (máx. 3 MB).'
            : 'Al elegir un archivo se sube de inmediato (máx. 3 MB), como en caminos de conocimiento.'}
        </Typography>

        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || uploadingCover}
          sx={{ alignSelf: 'flex-start' }}
        >
          {saving ? 'Guardando…' : isCreate ? 'Crear y continuar' : 'Guardar cambios'}
        </Button>
      </Stack>
    </Box>
  );
};

export default BookClubAdminGeneral;
