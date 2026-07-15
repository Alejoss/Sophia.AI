import React, { useCallback, useContext, useEffect, useState } from 'react';
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
import { AuthContext } from '../context/AuthContext';
import bookClubsApi from '../api/bookClubsApi';
import CommentSection from '../comments/CommentSection';
import { CLUB_ACCENT } from './clubTheme';

const DiscussionQuestionDetail = () => {
  const { slug, questionId } = useParams();
  const { authState } = useContext(AuthContext);
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await bookClubsApi.getDiscussionQuestion(slug, questionId);
      setQuestion(data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo cargar la pregunta.');
      setQuestion(null);
    } finally {
      setLoading(false);
    }
  }, [slug, questionId]);

  useEffect(() => {
    if (authState.isAuthenticated) load();
    else setLoading(false);
  }, [authState.isAuthenticated, load]);

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

  const canAnswer = question.can_answer;
  const closed = question.status === 'closed' || question.effective_status === 'closed';

  return (
    <Box>
      <Button
        component={RouterLink}
        to={`/club-de-lectura/${slug}/preguntas`}
        sx={{ color: CLUB_ACCENT, mb: 2 }}
      >
        ← Todas las preguntas
      </Button>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {question.mission_label && (
        <Typography variant="overline" sx={{ color: CLUB_ACCENT, fontWeight: 700 }}>
          Después de {question.mission_label}
        </Typography>
      )}
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
        {question.body}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <Chip
          label={question.effective_status || question.status}
          size="small"
          sx={{ bgcolor: 'rgba(255,107,53,0.2)', color: CLUB_ACCENT }}
        />
        <Chip
          label={`${question.answer_count} respuesta${question.answer_count === 1 ? '' : 's'}`}
          size="small"
          variant="outlined"
          sx={{ borderColor: 'rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.8)' }}
        />
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
          '& .MuiInputBase-root': { color: '#fff' },
        }}
      >
        <CommentSection
          discussionQuestionId={Number(questionId)}
          readOnly={!canAnswer || closed}
          title="Respuestas de la comunidad"
          placeholder="Comparte tu respuesta — todos en el club podrán leerla…"
        />
      </Box>
    </Box>
  );
};

export default DiscussionQuestionDetail;
