import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { AuthContext } from '../context/AuthContext';
import bookClubsApi from '../api/bookClubsApi';
import { useBookClub } from './BookClubLayout';
import { CLUB_ACCENT, CLUB_ACCENT_HOVER, CLUB_TEXT_FIELD_SX, QUESTION_STATUS_LABELS } from './clubTheme';

const DiscussionQuestionsList = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { authState } = useContext(AuthContext);
  const { hub, reload, club, guestToken, canParticipate } = useBookClub();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [creating, setCreating] = useState(false);

  const canManage = Boolean(canParticipate && club?.can_manage);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bookClubsApi.listDiscussionQuestions(slug, undefined, {
        guestToken: guestToken || undefined,
      });
      setQuestions(data);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudieron cargar las preguntas.');
    } finally {
      setLoading(false);
    }
  }, [slug, guestToken]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!newQuestion.trim()) return;
    setCreating(true);
    try {
      await bookClubsApi.createDiscussionQuestion(slug, {
        body: newQuestion.trim(),
        status: 'open',
        order: (questions?.length || 0) + 1,
        node: hub?.next_mission?.node_id || null,
      });
      setNewQuestion('');
      await load();
      await reload();
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo crear la pregunta.');
    } finally {
      setCreating(false);
    }
  };

  const open = questions.filter((q) => q.status === 'open' || q.effective_status === 'open');
  const past = questions.filter((q) => q.status === 'closed' || q.effective_status === 'closed');
  const drafts = questions.filter((q) => q.status === 'draft');

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress sx={{ color: CLUB_ACCENT }} />
      </Box>
    );
  }

  const renderGroup = (title, items) => (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        {title}
      </Typography>
      {!items.length ? (
        <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>Ninguna por ahora.</Typography>
      ) : (
        <Stack spacing={2}>
          {items.map((q) => (
            <Box
              key={q.id}
              onClick={() => navigate(`/club-de-lectura/${slug}/foro/${q.id}`)}
              sx={{
                cursor: 'pointer',
                p: 2,
                borderRadius: 1,
                border: '1px solid rgba(255,255,255,0.1)',
                '&:hover': { borderColor: CLUB_ACCENT },
              }}
            >
              {q.mission_label && (
                <Typography variant="caption" sx={{ color: CLUB_ACCENT, fontWeight: 600 }}>
                  Después de {q.mission_label}
                </Typography>
              )}
              <Typography sx={{ fontWeight: 500 }}>{q.body}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip
                  size="small"
                  label={
                    QUESTION_STATUS_LABELS[q.effective_status || q.status] ||
                    q.effective_status ||
                    q.status
                  }
                  sx={{ bgcolor: 'rgba(255,107,53,0.15)', color: CLUB_ACCENT }}
                />
                {q.can_see_answers && q.answer_count != null && (
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', alignSelf: 'center' }}>
                    {q.answer_count} respuesta{q.answer_count === 1 ? '' : 's'}
                  </Typography>
                )}
                {!q.can_see_answers && q.effective_status !== 'draft' && q.status !== 'draft' && (
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', alignSelf: 'center' }}>
                    Responde para ver el hilo
                  </Typography>
                )}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Foro
      </Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.65)', mb: 3 }}>
        Preguntas guiadas por el mentor. Publica tu respuesta para ver las de los demás miembros.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {canManage && (
        <Box
          sx={{
            mb: 4,
            p: 2.5,
            border: '1px solid rgba(255,107,53,0.35)',
            borderRadius: 1,
            bgcolor: 'rgba(255,107,53,0.05)',
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'rgba(255,255,255,0.9)' }}>
            Iniciar una conversación (staff)
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={2}
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Escribe la pregunta que quieres abrir al club…"
            sx={{ mb: 1.5, ...CLUB_TEXT_FIELD_SX }}
          />
          <Button
            variant="contained"
            disabled={creating || !newQuestion.trim()}
            onClick={handleCreate}
            sx={{ bgcolor: CLUB_ACCENT, '&:hover': { bgcolor: CLUB_ACCENT_HOVER } }}
          >
            Abrir pregunta
          </Button>
        </Box>
      )}

      {renderGroup('Abiertas', open)}
      {drafts.length > 0 && renderGroup('Borradores', drafts)}
      {renderGroup('Pasadas', past)}
    </Box>
  );
};

export default DiscussionQuestionsList;
