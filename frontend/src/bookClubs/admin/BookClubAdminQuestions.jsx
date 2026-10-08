import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  QUESTION_STATUSES,
  toDatetimeLocal,
  toIsoOrNull,
} from '../clubTheme';

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
  const { t } = useTranslation('bookClubs');
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
      setError(extractApiError(err, t('errors.loadQuestions')));
    }
  }, [slug, t]);

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
      throw new Error(t('questionAdmin.bodyRequired'));
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
      if (!iso) throw new Error(t('questionAdmin.opensInvalid'));
      payload.opens_at = iso;
    } else if (editingId) {
      payload.opens_at = null;
    }
    if (form.closes_at) {
      const iso = toIsoOrNull(form.closes_at);
      if (!iso) throw new Error(t('questionAdmin.closesInvalid'));
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
        setSuccess(t('questionAdmin.updated'));
      } else {
        await bookClubsApi.createDiscussionQuestion(slug, {
          ...payload,
          order: payload.order ?? questions.length + 1,
        });
        setSuccess(
          payload.status === 'draft'
            ? t('questionAdmin.draftSaved')
            : t('questionAdmin.published')
        );
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(
        err?.message && !err?.response
          ? err.message
          : extractApiError(err, t('errors.saveQuestion'))
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
      setError(extractApiError(err, t('errors.changeStatus')));
    }
  };

  const handleDelete = async (q) => {
    if (!window.confirm(t('questionAdmin.confirmDelete'))) return;
    setError(null);
    try {
      await bookClubsApi.deleteDiscussionQuestion(slug, q.id);
      if (editingId === q.id) cancelEdit();
      setSuccess(t('questionAdmin.deleted'));
      await load();
    } catch (err) {
      setError(extractApiError(err, t('errors.deleteQuestion')));
    }
  };

  const statusLabel = (q) =>
    t(`questionStatus.${q.effective_status || q.status}`, {
      defaultValue: q.effective_status || q.status,
    });

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('questionAdmin.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('questionAdmin.intro')}
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
          {editingId ? t('questionAdmin.editing', { id: editingId }) : t('questionAdmin.new')}
        </Typography>
        <TextField
          label={t('questionAdmin.body')}
          fullWidth
          multiline
          minRows={2}
          value={form.body}
          onChange={setField('body')}
          required
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl fullWidth>
            <InputLabel id="q-status">{t('questionAdmin.status')}</InputLabel>
            <Select
              labelId="q-status"
              label={t('questionAdmin.status')}
              value={form.status}
              onChange={setField('status')}
            >
              {QUESTION_STATUSES.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`questionStatus.${value}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label={t('questionAdmin.order')}
            type="number"
            fullWidth
            value={form.order}
            onChange={setField('order')}
            helperText={t('questionAdmin.optional')}
          />
        </Stack>
        <FormControl fullWidth>
          <InputLabel id="q-node">{t('questionAdmin.afterMission')}</InputLabel>
          <Select
            labelId="q-node"
            label={t('questionAdmin.afterMission')}
            value={form.node}
            onChange={setField('node')}
          >
            <MenuItem value="">{t('questionAdmin.noMission')}</MenuItem>
            {nodes.map((n) => (
              <MenuItem key={n.id} value={String(n.id)}>
                {t('questionAdmin.missionOption', { order: n.order, title: n.title })}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel id="q-event">{t('questionAdmin.afterLive')}</InputLabel>
          <Select
            labelId="q-event"
            label={t('questionAdmin.afterLive')}
            value={form.event}
            onChange={setField('event')}
          >
            <MenuItem value="">{t('questionAdmin.noMeeting')}</MenuItem>
            {events.map((ev) => (
              <MenuItem key={ev.event_id} value={String(ev.event_id)}>
                {ev.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label={t('questionAdmin.opensAt')}
            type="datetime-local"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={form.opens_at}
            onChange={setField('opens_at')}
            helperText={t('questionAdmin.opensHelper')}
          />
          <TextField
            label={t('questionAdmin.closesAt')}
            type="datetime-local"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={form.closes_at}
            onChange={setField('closes_at')}
            helperText={t('questionAdmin.closesHelper')}
          />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.body.trim()}>
            {saving ? t('questionAdmin.saving') : editingId ? t('questionAdmin.saveChanges') : t('questionAdmin.create')}
          </Button>
          {editingId && (
            <Button onClick={cancelEdit} disabled={saving}>
              {t('questionAdmin.cancel')}
            </Button>
          )}
        </Stack>
      </Stack>

      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
        {t('questionAdmin.list', { count: questions.length })}
      </Typography>
      {!questions.length ? (
        <Typography color="text.secondary">{t('questionAdmin.empty')}</Typography>
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
                      <Chip size="small" variant="outlined" label={t('questionAdmin.liveChip', { title: q.event_title })} />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    {t('overview.answers', { count: q.answer_count })}
                    {q.opens_at ? t('questionAdmin.opens', { date: formatClubDate(q.opens_at) }) : ''}
                    {q.closes_at ? t('questionAdmin.closes', { date: formatClubDate(q.closes_at) }) : ''}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {q.status !== 'open' && (
                    <Button size="small" onClick={() => quickStatus(q, 'open')}>
                      {t('questionAdmin.open')}
                    </Button>
                  )}
                  {q.status === 'open' && (
                    <Button size="small" onClick={() => quickStatus(q, 'closed')}>
                      {t('questionAdmin.close')}
                    </Button>
                  )}
                  <Button size="small" onClick={() => startEdit(q)}>
                    {t('questionAdmin.edit')}
                  </Button>
                  <Button
                    size="small"
                    component={RouterLink}
                    to={`/club-de-lectura/${club.slug}/foro/${q.id}`}
                  >
                    {t('questionAdmin.viewInForum')}
                  </Button>
                  <Button size="small" color="error" onClick={() => handleDelete(q)}>
                    {t('questionAdmin.delete')}
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
