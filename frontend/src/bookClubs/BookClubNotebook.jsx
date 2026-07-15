import React, { useContext, useEffect, useMemo, useState } from 'react';
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
import { AuthContext } from '../context/AuthContext';
import { useBookClub } from './BookClubLayout';
import { CLUB_ACCENT, CLUB_ACCENT_HOVER, formatClubDate } from './clubTheme';
import { loadNotebook, notebookStats, saveNotebook } from './clubExperience';

const NOTE_TYPES = [
  { value: 'idea', label: 'Idea' },
  { value: 'reflection', label: 'Reflexión' },
  { value: 'quote', label: 'Cita' },
  { value: 'question', label: 'Pregunta' },
];

const BookClubNotebook = () => {
  const { slug, hub } = useBookClub();
  const { authState } = useContext(AuthContext);
  const userId = authState.user?.id;
  const [notes, setNotes] = useState(() => loadNotebook(userId, slug).notes);
  const [body, setBody] = useState('');
  const [type, setType] = useState('reflection');
  const [error, setError] = useState('');

  useEffect(() => {
    setNotes(loadNotebook(userId, slug).notes);
  }, [userId, slug]);

  const stats = useMemo(() => notebookStats(notes), [notes]);

  const persist = (next) => {
    setNotes(next);
    saveNotebook(userId, slug, next);
  };

  const handleAdd = () => {
    if (!body.trim()) {
      setError('Escribe algo antes de guardar.');
      return;
    }
    const note = {
      id: `${Date.now()}`,
      type,
      body: body.trim(),
      created_at: new Date().toISOString(),
    };
    persist([note, ...notes]);
    setBody('');
    setError('');
  };

  const handleDelete = (id) => {
    persist(notes.filter((n) => n.id !== id));
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Mi cuaderno
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.65)', maxWidth: 560 }}>
          Tu espacio personal en este club: ideas, citas, preguntas y reflexiones sobre{' '}
          <em>{hub.club.title}</em>. Solo tú ves estas notas en este dispositivo.
        </Typography>
      </Box>

      <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
        {stats.idea} ideas · {stats.reflection} reflexiones · {stats.quote} citas ·{' '}
        {stats.question} preguntas
      </Typography>

      {hub.progress?.completed_nodes > 0 && (
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)' }}>
          Has completado {hub.progress.completed_nodes} de {hub.progress.total_nodes} misiones en
          este ciclo.
        </Typography>
      )}

      <Box
        sx={{
          p: 2.5,
          border: '1px solid rgba(255,107,53,0.35)',
          borderRadius: 1,
          bgcolor: 'rgba(255,107,53,0.05)',
        }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
          Nueva nota
        </Typography>
        <Stack spacing={1.5}>
          <FormControl fullWidth size="small">
            <InputLabel id="note-type" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              Tipo
            </InputLabel>
            <Select
              labelId="note-type"
              label="Tipo"
              value={type}
              onChange={(e) => setType(e.target.value)}
              sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
            >
              {NOTE_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            multiline
            minRows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="¿Qué te dejó pensando esta lectura?"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.06)',
                color: '#fff',
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255,107,53,0.35)',
              },
            }}
          />
          {error && (
            <Alert severity="warning" onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <Button
            variant="contained"
            onClick={handleAdd}
            sx={{
              alignSelf: 'flex-start',
              bgcolor: CLUB_ACCENT,
              '&:hover': { bgcolor: CLUB_ACCENT_HOVER },
            }}
          >
            Guardar en mi cuaderno
          </Button>
        </Stack>
      </Box>

      {!notes.length ? (
        <Box>
          <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
            Todavía está en blanco — y eso está bien
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', mt: 0.75, maxWidth: 480 }}>
            Cada nota que guardes refuerza tu lectura. Empieza con una cita o una duda después de
            la próxima misión.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={2}>
          {notes.map((note) => (
            <Box
              key={note.id}
              sx={{
                p: 2,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Typography variant="caption" sx={{ color: CLUB_ACCENT, fontWeight: 700 }}>
                {NOTE_TYPES.find((t) => t.value === note.type)?.label || note.type}
                {' · '}
                {formatClubDate(note.created_at)}
              </Typography>
              <Typography sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}>{note.body}</Typography>
              <Button
                size="small"
                onClick={() => handleDelete(note.id)}
                sx={{ mt: 1, color: 'rgba(255,255,255,0.4)' }}
              >
                Eliminar
              </Button>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

export default BookClubNotebook;
