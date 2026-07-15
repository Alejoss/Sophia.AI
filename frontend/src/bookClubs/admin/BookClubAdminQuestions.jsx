import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import bookClubsApi from '../../api/bookClubsApi';
import { extractApiError } from '../clubTheme';

const BookClubAdminQuestions = () => {
  const { slug } = useParams();
  const { club } = useOutletContext();
  const [questions, setQuestions] = useState([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await bookClubsApi.listDiscussionQuestions(slug);
      setQuestions(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(extractApiError(err, 'No se pudieron cargar las preguntas.'));
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!body.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await bookClubsApi.createDiscussionQuestion(slug, {
        body: body.trim(),
        status: 'open',
        order: questions.length + 1,
      });
      setBody('');
      setSuccess('Pregunta publicada.');
      await load();
    } catch (err) {
      setError(extractApiError(err, 'No se pudo crear la pregunta.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Preguntas de debate
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Gestiona las preguntas visibles en el club. También puedes publicarlas desde el hub si eres mentor.
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

      <Stack spacing={1.5} sx={{ mb: 3, maxWidth: 640 }}>
        <TextField
          label="Nueva pregunta"
          fullWidth
          multiline
          minRows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={saving || !body.trim()}
          sx={{ alignSelf: 'flex-start' }}
        >
          Publicar abierta
        </Button>
      </Stack>

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
                display: 'flex',
                gap: 2,
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <Box>
                <Typography fontWeight={600}>{q.body}</Typography>
                <Chip size="small" label={q.effective_status || q.status} sx={{ mt: 0.5 }} />
              </Box>
              <Button
                size="small"
                component={RouterLink}
                to={`/club-de-lectura/${club.slug}/preguntas/${q.id}`}
              >
                Abrir
              </Button>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default BookClubAdminQuestions;
