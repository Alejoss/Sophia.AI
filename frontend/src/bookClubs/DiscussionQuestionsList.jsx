import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import bookClubsApi from '../api/bookClubsApi';

const accent = '#FF6B35';

const DiscussionQuestionsList = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { authState } = useContext(AuthContext);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bookClubsApi.listDiscussionQuestions(slug);
      setQuestions(data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudieron cargar las preguntas.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (authState.isAuthenticated) load();
    else setLoading(false);
  }, [authState.isAuthenticated, load]);

  const open = questions.filter((q) => q.status === 'open' || q.effective_status === 'open');
  const past = questions.filter((q) => q.status === 'closed' || q.effective_status === 'closed');
  const drafts = questions.filter((q) => q.status === 'draft');

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: accent }} />
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
              onClick={() => navigate(`/club-de-lectura/${slug}/preguntas/${q.id}`)}
              sx={{
                cursor: 'pointer',
                p: 2,
                borderRadius: 1,
                border: '1px solid rgba(255,255,255,0.1)',
                '&:hover': { borderColor: accent },
              }}
            >
              {q.mission_label && (
                <Typography variant="caption" sx={{ color: accent, fontWeight: 600 }}>
                  Después de {q.mission_label}
                </Typography>
              )}
              <Typography sx={{ fontWeight: 500 }}>{q.body}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip
                  size="small"
                  label={q.effective_status || q.status}
                  sx={{ bgcolor: 'rgba(255,107,53,0.15)', color: accent }}
                />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', alignSelf: 'center' }}>
                  {q.answer_count} respuesta{q.answer_count === 1 ? '' : 's'}
                </Typography>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );

  return (
    <Box sx={{ bgcolor: '#0d0d0d', minHeight: '100%', color: '#fff', py: { xs: 3, md: 5 } }}>
      <Container maxWidth="md">
        <Button component={RouterLink} to={`/club-de-lectura/${slug}`} sx={{ color: accent, mb: 2 }}>
          ← Volver al hub
        </Button>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
          Preguntas de debate
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {renderGroup('Abiertas', open)}
        {drafts.length > 0 && renderGroup('Borradores', drafts)}
        {renderGroup('Pasadas', past)}
      </Container>
    </Box>
  );
};

export default DiscussionQuestionsList;
