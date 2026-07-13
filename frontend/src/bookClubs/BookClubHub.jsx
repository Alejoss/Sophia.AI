import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import bookClubsApi from '../api/bookClubsApi';

const accent = '#FF6B35';

const Section = ({ title, children, action }) => (
  <Box
    sx={{
      mb: 4,
      pb: 3,
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}
  >
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
        {title}
      </Typography>
      {action}
    </Stack>
    {children}
  </Box>
);

const formatDate = (value) => {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
};

const BookClubHub = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { authState, authInitialized } = useContext(AuthContext);
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [creatingQuestion, setCreatingQuestion] = useState(false);

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await bookClubsApi.getHub(slug);
      setHub(data);
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        'No se pudo cargar el hub del club. ¿Estás autenticado?';
      setError(detail);
      setHub(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!authInitialized) return;
    if (!authState.isAuthenticated) {
      setLoading(false);
      setError('Inicia sesión para entrar al hub del club.');
      return;
    }
    loadHub();
  }, [authInitialized, authState.isAuthenticated, loadHub]);

  const handleJoin = async () => {
    setJoining(true);
    setError('');
    try {
      await bookClubsApi.joinClub(slug);
      await loadHub();
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo unir al club.');
    } finally {
      setJoining(false);
    }
  };

  const handleCreateQuestion = async () => {
    if (!newQuestion.trim()) return;
    setCreatingQuestion(true);
    try {
      await bookClubsApi.createDiscussionQuestion(slug, {
        body: newQuestion.trim(),
        status: 'open',
        order: (hub?.open_questions?.length || 0) + 1,
        node: hub?.next_mission?.node_id || null,
      });
      setNewQuestion('');
      await loadHub();
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudo crear la pregunta.');
    } finally {
      setCreatingQuestion(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: accent }} />
      </Box>
    );
  }

  if (!authState.isAuthenticated) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          {error || 'Inicia sesión para acceder al Club de Lectura.'}
        </Alert>
        <Button
          variant="contained"
          component={RouterLink}
          to="/profiles/login"
          sx={{ bgcolor: accent, '&:hover': { bgcolor: '#E55A2B' } }}
        >
          Iniciar sesión
        </Button>
      </Container>
    );
  }

  if (error && !hub) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const club = hub.club;
  const progressPct = Math.round(hub.progress?.percentage || 0);
  const canManage = club.can_manage;

  return (
    <Box sx={{ bgcolor: '#0d0d0d', minHeight: '100%', color: '#fff', py: { xs: 3, md: 5 } }}>
      <Container maxWidth="md">
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography
            variant="overline"
            sx={{ color: accent, letterSpacing: 2, fontWeight: 700 }}
          >
            Club de Lectura
          </Typography>
          <Typography variant="h3" component="h1" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
            {club.title}
          </Typography>
          {club.description && (
            <Typography sx={{ color: 'rgba(255,255,255,0.7)', maxWidth: 640 }}>
              {club.description}
            </Typography>
          )}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              label={club.status}
              size="small"
              sx={{ bgcolor: 'rgba(255,107,53,0.2)', color: accent }}
            />
            {club.starts_at && (
              <Chip
                label={`Inicio: ${formatDate(club.starts_at)}`}
                size="small"
                variant="outlined"
                sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }}
              />
            )}
            {club.ends_at && (
              <Chip
                label={`Cierre: ${formatDate(club.ends_at)}`}
                size="small"
                variant="outlined"
                sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }}
              />
            )}
          </Stack>

          {!hub.is_member && (
            <Button
              variant="contained"
              onClick={handleJoin}
              disabled={joining}
              sx={{ alignSelf: 'flex-start', mt: 1, bgcolor: accent, '&:hover': { bgcolor: '#E55A2B' } }}
            >
              {joining ? 'Uniéndote…' : 'Unirme al club'}
            </Button>
          )}
        </Stack>

        {hub.is_member && (
          <>
            <Section title="Tu progreso">
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                {hub.progress.completed_nodes} de {hub.progress.total_nodes} misiones ·{' '}
                {progressPct}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={progressPct}
                sx={{
                  height: 10,
                  borderRadius: 1,
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '& .MuiLinearProgress-bar': { bgcolor: accent },
                }}
              />
            </Section>

            <Section
              title="Próxima misión"
              action={
                hub.next_mission && (
                  <Button
                    size="small"
                    component={RouterLink}
                    to={`/knowledge_path/${hub.next_mission.path_id}/nodes/${hub.next_mission.node_id}`}
                    sx={{ color: accent }}
                  >
                    Abrir
                  </Button>
                )
              }
            >
              {hub.next_mission ? (
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>
                    Misión {hub.next_mission.order}: {hub.next_mission.title}
                  </Typography>
                  {hub.next_mission.locked && (
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', mt: 0.5 }}>
                      Aún bloqueada — completa la misión anterior primero.
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
                  {hub.progress.is_completed
                    ? 'Completaste todas las misiones del ciclo.'
                    : 'No hay misiones pendientes.'}
                </Typography>
              )}
            </Section>

            <Section
              title="Próxima reunión"
              action={
                <Button
                  size="small"
                  component={RouterLink}
                  to={`/club-de-lectura/${slug}/reuniones`}
                  sx={{ color: accent }}
                >
                  Ver todas
                </Button>
              }
            >
              {hub.next_event ? (
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{hub.next_event.title}</Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', mt: 0.5 }}>
                    {formatDate(hub.next_event.date_start) || 'Fecha por confirmar'}
                    {hub.next_event.is_past ? ' · (pasar)' : ''}
                  </Typography>
                  {hub.next_event.schedule_description && (
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', mt: 1 }}>
                      {hub.next_event.schedule_description}
                    </Typography>
                  )}
                  <Button
                    size="small"
                    component={RouterLink}
                    to={`/events/${hub.next_event.event_id}`}
                    sx={{ mt: 1, color: accent }}
                  >
                    Detalle del evento
                  </Button>
                </Box>
              ) : (
                <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
                  Todavía no hay reuniones programadas.
                </Typography>
              )}
            </Section>

            <Section
              title="Preguntas abiertas"
              action={
                <Button
                  size="small"
                  component={RouterLink}
                  to={`/club-de-lectura/${slug}/preguntas`}
                  sx={{ color: accent }}
                >
                  Ver todas
                </Button>
              }
            >
              {hub.open_questions?.length ? (
                <Stack spacing={2}>
                  {hub.open_questions.map((q) => (
                    <Box
                      key={q.id}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { opacity: 0.9 },
                      }}
                      onClick={() => navigate(`/club-de-lectura/${slug}/preguntas/${q.id}`)}
                    >
                      {q.mission_label && (
                        <Typography variant="caption" sx={{ color: accent, fontWeight: 600 }}>
                          Después de {q.mission_label}
                        </Typography>
                      )}
                      <Typography sx={{ fontWeight: 500 }}>{q.body}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        {q.answer_count} respuesta{q.answer_count === 1 ? '' : 's'}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
                  No hay preguntas abiertas ahora. Vuelve después del próximo directo.
                </Typography>
              )}

              {canManage && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: 'rgba(255,255,255,0.8)' }}>
                    Publicar pregunta de debate
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder="¿Qué concepto aplicarías mañana?"
                    sx={{
                      mb: 1,
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'rgba(255,255,255,0.06)',
                        color: '#fff',
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,107,53,0.4)',
                      },
                    }}
                  />
                  <Button
                    variant="contained"
                    disabled={creatingQuestion || !newQuestion.trim()}
                    onClick={handleCreateQuestion}
                    sx={{ bgcolor: accent, '&:hover': { bgcolor: '#E55A2B' } }}
                  >
                    Abrir pregunta
                  </Button>
                </Box>
              )}
            </Section>

            {hub.past_questions?.length > 0 && (
              <Section title="Preguntas pasadas">
                <Stack spacing={2}>
                  {hub.past_questions.slice(0, 5).map((q) => (
                    <Box
                      key={q.id}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/club-de-lectura/${slug}/preguntas/${q.id}`)}
                    >
                      {q.mission_label && (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>
                          {q.mission_label}
                        </Typography>
                      )}
                      <Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>{q.body}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>
                        {q.answer_count} respuesta{q.answer_count === 1 ? '' : 's'} · cerrada
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Section>
            )}

            <Section title="Actividad reciente">
              {hub.recent_activity?.length ? (
                <Stack spacing={1.5} divider={<Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />}>
                  {hub.recent_activity.map((item) => (
                    <Box key={`${item.type}-${item.comment_id}`}>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
                        <strong>{item.author}</strong>:{' '}
                        {item.body_preview}
                        {item.body_preview?.length >= 120 ? '…' : ''}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                        {item.type === 'discussion_answer' ? 'Respuesta de debate' : 'Comunidad'} ·{' '}
                        {formatDate(item.created_at)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
                  Todavía no hay actividad. Sé el primero en responder una pregunta.
                </Typography>
              )}
            </Section>

            <Section title="Accesos rápidos">
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
                {hub.quick_links.knowledge_path_id && (
                  <Button
                    variant="outlined"
                    component={RouterLink}
                    to={`/knowledge_path/${hub.quick_links.knowledge_path_id}`}
                    sx={{ borderColor: accent, color: accent }}
                  >
                    Misiones
                  </Button>
                )}
                {hub.quick_links.topic_id && (
                  <Button
                    variant="outlined"
                    component={RouterLink}
                    to={`/topics/${hub.quick_links.topic_id}`}
                    sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}
                  >
                    Comunidad
                  </Button>
                )}
                <Button
                  variant="outlined"
                  component={RouterLink}
                  to={`/club-de-lectura/${slug}/preguntas`}
                  sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}
                >
                  Preguntas
                </Button>
                <Button
                  variant="outlined"
                  component={RouterLink}
                  to={`/club-de-lectura/${slug}/reuniones`}
                  sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}
                >
                  Reuniones
                </Button>
              </Stack>
            </Section>
          </>
        )}
      </Container>
    </Box>
  );
};

export default BookClubHub;
