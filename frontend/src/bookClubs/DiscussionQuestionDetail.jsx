import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import bookClubsApi from '../api/bookClubsApi';
import CommentSection from '../comments/CommentSection';
import { useBookClub } from './BookClubLayout';
import { CLUB_ACCENT, CLUB_NESTED_FIELDS_SX, QUESTION_STATUS_LABELS } from './clubTheme';
import { getGuestSession, guestCompleteAccountUrl } from './guestStorage';

const DiscussionQuestionDetail = () => {
  const { slug, questionId } = useParams();
  const { guestToken, canParticipate } = useBookClub();
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await bookClubsApi.getDiscussionQuestion(slug, questionId, {
        guestToken: guestToken || undefined,
      });
      setQuestion(data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo cargar la pregunta.');
      setQuestion(null);
    } finally {
      setLoading(false);
    }
  }, [slug, questionId, guestToken]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (status) => {
    setUpdating(true);
    try {
      const data = await bookClubsApi.updateDiscussionQuestion(slug, questionId, { status });
      setQuestion(data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo actualizar.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress sx={{ color: CLUB_ACCENT }} />
      </Box>
    );
  }

  if (error && !question) {
    return <Alert severity="error">{error}</Alert>;
  }

  const canAnswer = Boolean(question.can_answer && canParticipate);
  const canSeeAnswers = Boolean(question.can_see_answers);
  const closed = question.status === 'closed' || question.effective_status === 'closed';
  const guest = getGuestSession(slug);
  const accountUrl = guest?.token
    ? guestCompleteAccountUrl(slug, guest.token)
    : `/profiles/register?next=${encodeURIComponent(`/club-de-lectura/${slug}/foro/${questionId}`)}`;

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Button
          component={RouterLink}
          to={`/club-de-lectura/${slug}/foro`}
          sx={{ color: CLUB_ACCENT, px: 0, minWidth: 0, flexShrink: 0 }}
        >
          ← Todas las preguntas del foro
        </Button>
        {question.mission_label && (
          <Typography
            variant="overline"
            sx={{
              color: CLUB_ACCENT,
              fontWeight: 700,
              textAlign: 'right',
              lineHeight: 1.4,
              pt: 0.75,
            }}
          >
            Después de {question.mission_label}
          </Typography>
        )}
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {!canParticipate && (
        <Alert
          severity="info"
          sx={{ mb: 2, bgcolor: 'rgba(255,107,53,0.1)', color: '#fff' }}
          action={
            <Button component={RouterLink} to={accountUrl} sx={{ color: CLUB_ACCENT, fontWeight: 700 }}>
              Crear cuenta
            </Button>
          }
        >
          Puedes leer la pregunta. Para responder y ver las respuestas de los demás, crea tu cuenta.
        </Alert>
      )}

      {canParticipate && !canSeeAnswers && canAnswer && (
        <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(255,107,53,0.1)', color: '#fff' }}>
          Publica tu respuesta para desbloquear las respuestas de los demás miembros.
        </Alert>
      )}

      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
        {question.body}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <Chip
          label={
            QUESTION_STATUS_LABELS[question.effective_status || question.status] ||
            question.effective_status ||
            question.status
          }
          size="small"
          sx={{ bgcolor: 'rgba(255,107,53,0.2)', color: CLUB_ACCENT }}
        />
        {canSeeAnswers && question.answer_count != null && (
          <Chip
            label={`${question.answer_count} respuesta${question.answer_count === 1 ? '' : 's'}`}
            size="small"
            variant="outlined"
            sx={{ borderColor: 'rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.8)' }}
          />
        )}
      </Stack>

      {question.can_manage && (
        <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
          {question.status !== 'open' && (
            <Button
              size="small"
              variant="contained"
              disabled={updating}
              onClick={() => setStatus('open')}
              sx={{ bgcolor: CLUB_ACCENT }}
            >
              Abrir
            </Button>
          )}
          {question.status === 'open' && (
            <Button
              size="small"
              variant="outlined"
              disabled={updating}
              onClick={() => setStatus('closed')}
              sx={{ borderColor: CLUB_ACCENT, color: CLUB_ACCENT }}
            >
              Cerrar conversación
            </Button>
          )}
        </Stack>
      )}

      <Box
        sx={{
          '& .MuiPaper-root': {
            bgcolor: 'rgba(255,255,255,0.04)',
            color: '#fff',
            backgroundImage: 'none',
          },
          '& .MuiTypography-root': { color: 'inherit' },
          '& .MuiAlert-root': {
            bgcolor: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.9)',
          },
          ...CLUB_NESTED_FIELDS_SX,
        }}
      >
        <CommentSection
          discussionQuestionId={Number(questionId)}
          readOnly={!canAnswer || closed}
          hideComments={!canSeeAnswers}
          hideForm={Boolean(question.has_answered)}
          hideFormNotice="Ya publicaste tu respuesta. Puedes editarla abajo o responder a otros miembros."
          onAfterMutate={load}
          title="Respuestas del foro"
          placeholder="Comparte tu respuesta. Las de los demás se desbloquean cuando publiques la tuya."
          submitLabel="Publicar respuesta"
          emptyLabel="Aún no hay respuestas. Sé el primero."
          lockedEmptyLabel="Publica tu respuesta para ver las de los demás miembros."
        />
      </Box>
    </Box>
  );
};

export default DiscussionQuestionDetail;
