import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import bookClubsApi from '../../api/bookClubsApi';
import knowledgePathsApi from '../../api/knowledgePathsApi';
import {
  extractApiError,
  formatClubDate,
  QUESTION_STATUS_LABELS,
  toDatetimeLocal,
  toIsoOrNull,
} from '../clubTheme';

const STATUS_OPTIONS = Object.entries(QUESTION_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const emptyForm = {
  body: '',
  status: 'open',
  node: '',
  event: '',
  opens_at: '',
  closes_at: '',
  order: '',
};

const BookClubAdminQuestions = () => {
  const { slug } = useParams();
  const { club } = useOutletContext();
  const [questions, setQuestions] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [qs, clubEvents] = await Promise.all([
        bookClubsApi.listDiscussionQuestions(slug),
        bookClubsApi.listEvents(slug).catch(() => []),
      ]);
      setQuestions(Array.isArray(qs) ? qs : []);
      setEvents(Array.isArray(clubEvents) ? clubEvents : []);
      setError(null);
    } catch (err) {
      setError(extractApiError(err, 'No se pudieron cargar las preguntas.'));
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!club?.knowledge_path) {
      setNodes([]);
      return;
    }
    knowledgePathsApi
      .getKnowledgePath(club.knowledge_path)
      .then((path) => setNodes(Array.isArray(path?.nodes) ? path.nodes : []))
      .catch(() => setNodes([]));
  }, [club?.knowledge_path]);

  const setField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const startEdit = (q) => {
    setEditingId(q.id);
    setForm({
      body: q.body || '',
      status: q.status || 'open',
      node: q.node != null ? String(q.node) : '',
      event: q.event != null ? String(q.event) : '',
      opens_at: toDatetimeLocal(q.opens_at),
      closes_at: toDatetimeLocal(q.closes_at),
      order: q.order != null ? String(q.order) : '',
    });
    setSuccess(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const buildPayload = () => {
    if (!form.body.trim()) {
      throw new Error('El texto de la pregunta es obligatorio.');
    }
    const payload = {
      body: form.body.trim(),
      status: form.status,
      node: form.node === '' ? null : Number(form.node),
      event: form.event === '' ? null : Number(form.event),
    };
    if (form.order !== '') {
      payload.order = Number(form.order);
    }
    if (form.opens_at) {
      const iso = toIsoOrNull(form.opens_at);
      if (!iso) throw new Error('opens_at no es válida.');
      payload.opens_at = iso;
    } else if (editingId) {
      payload.opens_at = null;
    }
    if (form.closes_at) {
      const iso = toIsoOrNull(form.closes_at);
      if (!iso) throw new Error('closes_at no es válida.');
      payload.closes_at = iso;
    } else if (editingId) {
      payload.closes_at = null;
    }
    return payload;
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = buildPayload();
      if (editingId) {
        await bookClubsApi.updateDiscussionQuestion(slug, editingId, payload);
        setSuccess('Pregunta actualizada.');
      } else {
        await bookClubsApi.createDiscussionQuestion(slug, {
          ...payload,
          order: payload.order ?? questions.length + 1,
        });
        setSuccess(
          payload.status === 'draft'
            ? 'Borrador guardado.'
            : 'Pregunta publicada.'
        );
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(
        err?.message && !err?.response
          ? err.message
          : extractApiError(err, 'No se pudo guardar la pregunta.')
      );
    } finally {
      setSaving(false);
    }
  };

  const quickStatus = async (q, status) => {
    setError(null);
    try {
      await bookClubsApi.updateDiscussionQuestion(slug, q.id, { status });
      await load();
    } catch (err) {
      setError(extractApiError(err, 'No se pudo cambiar el estado.'));
    }
  };

  const handleDelete = async (q) => {
    if (!window.confirm('¿Eliminar esta pregunta del foro? No se puede deshacer.')) return;
    setError(null);
    try {
      await bookClubsApi.deleteDiscussionQuestion(slug, q.id);
      if (editingId === q.id) cancelEdit();
      setSuccess('Pregunta eliminada.');
      await load();
    } catch (err) {
      setError(extractApiError(err, 'No se pudo eliminar la pregunta.'));
    }
  };

  const statusLabel = (q) =>
    QUESTION_STATUS_LABELS[q.effective_status || q.status] || q.effective_status || q.status;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Preguntas del foro
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Crea, programa y cierra preguntas ligadas a misiones o reuniones. Se muestran en el hub
        (Foro) según su estado y fechas. Los miembros solo ven las respuestas de otros después de
        publicar la suya.
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

      <Stack
        spacing={2}
        sx={{
          mb: 4,
          maxWidth: 720,
          p: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          {editingId ? `Editando pregunta #${editingId}` : 'Nueva pregunta'}
        </Typography>
        <TextField
          label="Texto de la pregunta"
          fullWidth
          multiline
          minRows={2}
          value={form.body}
          onChange={setField('body')}
          required
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl fullWidth>
            <InputLabel id="q-status">Estado</InputLabel>
            <Select
              labelId="q-status"
              label="Estado"
              value={form.status}
              onChange={setField('status')}
            >
              {STATUS_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Orden"
            type="number"
            fullWidth
            value={form.order}
            onChange={setField('order')}
            helperText="Opcional"
          />
        </Stack>
        <FormControl fullWidth>
          <InputLabel id="q-node">Después de la misión</InputLabel>
          <Select
            labelId="q-node"
            label="Después de la misión"
            value={form.node}
            onChange={setField('node')}
          >
            <MenuItem value="">Sin misión vinculada</MenuItem>
            {nodes.map((n) => (
              <MenuItem key={n.id} value={String(n.id)}>
                Misión {n.order}: {n.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel id="q-event">Después del directo</InputLabel>
          <Select
            labelId="q-event"
            label="Después del directo"
            value={form.event}
            onChange={setField('event')}
          >
            <MenuItem value="">Sin reunión vinculada</MenuItem>
            {events.map((ev) => (
              <MenuItem key={ev.event_id} value={String(ev.event_id)}>
                {ev.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Abrir en"
            type="datetime-local"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={form.opens_at}
            onChange={setField('opens_at')}
            helperText="Opcional · auto-abre borradores"
          />
          <TextField
            label="Cerrar en"
            type="datetime-local"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={form.closes_at}
            onChange={setField('closes_at')}
            helperText="Opcional · auto-cierra abiertas"
          />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.body.trim()}>
            {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear pregunta'}
          </Button>
          {editingId && (
            <Button onClick={cancelEdit} disabled={saving}>
              Cancelar
            </Button>
          )}
        </Stack>
      </Stack>

      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
        Preguntas del club ({questions.length})
      </Typography>
      {!questions.length ? (
        <Typography color="text.secondary">Todavía no hay preguntas.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {questions.map((q) => (
            <Box
              key={q.id}
              sx={{
                py: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ sm: 'flex-start' }}
                spacing={1}
              >
                <Box>
                  <Typography fontWeight={600}>{q.body}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label={statusLabel(q)} />
                    {q.mission_label && (
                      <Chip size="small" variant="outlined" label={q.mission_label} />
                    )}
                    {q.event_title && (
                      <Chip size="small" variant="outlined" label={`Directo: ${q.event_title}`} />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    {q.answer_count} respuesta{q.answer_count === 1 ? '' : 's'}
                    {q.opens_at ? ` · abre ${formatClubDate(q.opens_at)}` : ''}
                    {q.closes_at ? ` · cierra ${formatClubDate(q.closes_at)}` : ''}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {q.status !== 'open' && (
                    <Button size="small" onClick={() => quickStatus(q, 'open')}>
                      Abrir
                    </Button>
                  )}
                  {q.status === 'open' && (
                    <Button size="small" onClick={() => quickStatus(q, 'closed')}>
                      Cerrar
                    </Button>
                  )}
                  <Button size="small" onClick={() => startEdit(q)}>
                    Editar
                  </Button>
                  <Button
                    size="small"
                    component={RouterLink}
                    to={`/club-de-lectura/${club.slug}/foro/${q.id}`}
                  >
                    Ver en foro
                  </Button>
                  <Button size="small" color="error" onClick={() => handleDelete(q)}>
                    Eliminar
                  </Button>
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default BookClubAdminQuestions;
