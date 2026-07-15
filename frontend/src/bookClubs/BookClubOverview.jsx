import React, { useContext, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Collapse,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import { useBookClub } from './BookClubLayout';
import { CLUB_ACCENT, CLUB_ACCENT_HOVER, formatClubDate } from './clubTheme';
import {
  daysUntil,
  loadNotebook,
  notebookStats,
  resolveExperiencePhase,
  resolveWeekLabel,
} from './clubExperience';

const SectionLabel = ({ children }) => (
  <Typography
    variant="overline"
    sx={{
      color: 'rgba(255,255,255,0.45)',
      letterSpacing: 1.5,
      fontWeight: 700,
      display: 'block',
      mb: 1.25,
    }}
  >
    {children}
  </Typography>
);

const PrimaryCta = ({ to, children, onClick }) => (
  <Button
    variant="contained"
    component={to ? RouterLink : 'button'}
    to={to}
    onClick={onClick}
    size="large"
    sx={{
      mt: 2,
      px: 3,
      py: 1.25,
      fontWeight: 700,
      bgcolor: CLUB_ACCENT,
      '&:hover': { bgcolor: CLUB_ACCENT_HOVER },
    }}
  >
    {children}
  </Button>
);

const BookClubOverview = () => {
  const { slug, hub, club } = useBookClub();
  const { authState } = useContext(AuthContext);
  const [aboutOpen, setAboutOpen] = useState(false);

  const phase = useMemo(
    () =>
      resolveExperiencePhase({
        club,
        progress: hub.progress,
        nextMission: hub.next_mission,
      }),
    [club, hub.progress, hub.next_mission]
  );
  const week = resolveWeekLabel({ club, progress: hub.progress });
  const pulse = hub.club_pulse || {};
  const nextMission = hub.next_mission;
  const weeklyQuestion = hub.open_questions?.[0];
  const progressPct = Math.round(hub.progress?.percentage || 0);
  const notebook = loadNotebook(authState.user?.id, slug);
  const notesStats = notebookStats(notebook.notes);
  const lastNote = notebook.notes[0];
  const daysToStart = daysUntil(club.starts_at);
  const daysToEvent = daysUntil(hub.next_event?.date_start);

  const missionHref = nextMission
    ? `/knowledge_path/${nextMission.path_id}/nodes/${nextMission.node_id}`
    : 'misiones';

  const hero = (() => {
    if (phase === 'pre') {
      return {
        eyebrow: daysToStart != null && daysToStart > 0 ? `Comenzamos en ${daysToStart} día${daysToStart === 1 ? '' : 's'}` : 'Estamos preparando el ciclo',
        title: 'Tu viaje de lectura está por empezar',
        body:
          pulse.member_count > 1
            ? `${pulse.member_count} lectores ya se han unido. Presenta quién eres y prepárate para la primera misión.`
            : 'Prepárate: pronto abrimos la primera misión y el debate colectivo.',
        cta: club.topic
          ? { label: 'Preséntate al club →', to: `/content/topics/${club.topic}` }
          : { label: 'Ver misiones →', to: 'misiones' },
      };
    }
    if (phase === 'finished') {
      return {
        eyebrow: 'Ciclo completado',
        title: `Terminaste ${club.title}`,
        body: `Durante este ciclo completaste ${hub.progress.completed_nodes} misiones${notesStats.reflection + notesStats.idea ? ` y guardaste ${notesStats.reflection + notesStats.idea} notas en tu cuaderno` : ''}.`,
        cta: { label: 'Ver mi viaje de lectura →', to: 'cuaderno' },
      };
    }
    if (phase === 'between') {
      return {
        eyebrow: 'Vas al día',
        title: 'Mientras llega lo siguiente…',
        body: weeklyQuestion
          ? 'Descubre qué están pensando otros lectores en el debate abierto.'
          : 'Usa el cuaderno o la comunidad mientras se abre la próxima misión.',
        cta: weeklyQuestion
          ? {
              label: 'Entrar al debate →',
              to: `/club-de-lectura/${slug}/preguntas/${weeklyQuestion.id}`,
            }
          : { label: 'Abrir mi cuaderno →', to: 'cuaderno' },
      };
    }
    // active
    if (nextMission && !nextMission.locked) {
      const first = (hub.progress?.completed_nodes || 0) === 0;
      return {
        eyebrow: `Semana ${week.weekNum} · ${first ? 'Empezamos' : 'Continúa'}`,
        title: nextMission.title,
        body:
          nextMission.description?.trim() ||
          'Sigue la lectura de esta misión y vuelve para el debate.',
        cta: {
          label: first
            ? `Comenzar misión ${nextMission.order} →`
            : `Continuar misión ${nextMission.order} →`,
          to: missionHref,
        },
      };
    }
    if (nextMission?.locked) {
      return {
        eyebrow: 'Próxima misión',
        title: nextMission.title,
        body: 'Todavía bloqueada. Completa la misión anterior o entra al debate mientras esperas.',
        cta: weeklyQuestion
          ? {
              label: 'Entrar al debate →',
              to: `/club-de-lectura/${slug}/preguntas/${weeklyQuestion.id}`,
            }
          : { label: 'Ver misiones →', to: 'misiones' },
      };
    }
    return {
      eyebrow: 'El club está activo',
      title: 'Las misiones se están preparando',
      body: 'Cuando el mentor publique la primera lectura, aparecerá aquí como tu acción principal.',
      cta: { label: 'Explorar el club →', to: 'comunidad' },
    };
  })();

  const activityLabel = (item) => {
    if (item.type === 'discussion_answer') return 'respondió al debate';
    return 'compartió en la comunidad';
  };

  return (
    <Stack spacing={5}>
      {/* Nivel 1 — Acción principal */}
      <Box
        sx={{
          p: { xs: 2.5, md: 3.5 },
          borderRadius: 1,
          border: `1px solid ${CLUB_ACCENT}`,
          background:
            'linear-gradient(135deg, rgba(255,107,53,0.16) 0%, rgba(255,255,255,0.03) 55%)',
        }}
      >
        <Typography
          variant="overline"
          sx={{ color: CLUB_ACCENT, fontWeight: 800, letterSpacing: 1.5 }}
        >
          {hero.eyebrow}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, lineHeight: 1.2 }}>
          {hero.title}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.72)', mt: 1.5, maxWidth: 560 }}>
          {hero.body}
        </Typography>
        <PrimaryCta to={hero.cta.to}>{hero.cta.label}</PrimaryCta>
      </Box>

      {/* Nivel 1b — Tu misión actual (solo si hay misión accionable y no es solo el hero) */}
      {phase === 'active' && nextMission && !nextMission.locked && (
        <Box>
          <SectionLabel>Tu misión actual</SectionLabel>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'auto 1fr', sm: '64px 1fr' },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Typography
              sx={{
                fontSize: '2rem',
                fontWeight: 800,
                color: CLUB_ACCENT,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {String(nextMission.order).padStart(2, '0')}
            </Typography>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {nextMission.title}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.65)', mt: 0.75, maxWidth: 520 }}>
                {nextMission.description?.trim() ||
                  'Lee con atención y vuelve para compartir lo que te dejó pensando.'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)', mt: 1.25 }}>
                Misión {nextMission.order} de {hub.progress.total_nodes || '—'} · tu progreso{' '}
                {progressPct}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={progressPct}
                sx={{
                  mt: 1,
                  height: 6,
                  borderRadius: 1,
                  maxWidth: 280,
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '& .MuiLinearProgress-bar': { bgcolor: CLUB_ACCENT },
                }}
              />
              <Button
                component={RouterLink}
                to={missionHref}
                sx={{ mt: 1.5, color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
              >
                Comenzar misión →
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Nivel 2 — El club esta semana */}
      <Box>
        <SectionLabel>El club esta semana</SectionLabel>
        {pulse.member_count ? (
          <>
            <Typography sx={{ fontWeight: 600, mb: 1 }}>
              {pulse.active_readers_7d || 0} lectores activos · {pulse.member_count} en el club
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, pulse.path_completion_pct || 0)}
              sx={{
                height: 8,
                borderRadius: 1,
                mb: 1.5,
                bgcolor: 'rgba(255,255,255,0.08)',
                '& .MuiLinearProgress-bar': { bgcolor: CLUB_ACCENT },
              }}
            />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', mb: 0.5 }}>
              {pulse.path_completion_pct || 0}% del camino recorrido en conjunto
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1.5, color: 'rgba(255,255,255,0.75)' }}>
              <Typography variant="body2">
                {pulse.first_mission_completions}{' '}
                {pulse.first_mission_completions === 1 ? 'persona terminó' : 'personas terminaron'}{' '}
                la Misión 1
              </Typography>
              <Typography variant="body2">
                {pulse.total_answers}{' '}
                {pulse.total_answers === 1 ? 'respuesta' : 'respuestas'} en debates abiertos
              </Typography>
              <Typography variant="body2">
                {pulse.open_debates}{' '}
                {pulse.open_debates === 1 ? 'debate activo' : 'debates activos'}
              </Typography>
            </Stack>
          </>
        ) : (
          <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
            La conversación colectiva arranca cuando más lectores se unan y completen la primera
            misión.
          </Typography>
        )}
      </Box>

      {/* Nivel 2 — Pregunta de la semana */}
      <Box>
        <SectionLabel>Pregunta de la semana</SectionLabel>
        {weeklyQuestion ? (
          <Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 600, fontStyle: 'italic', maxWidth: 560, lineHeight: 1.4 }}
            >
              “{weeklyQuestion.body}”
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mt: 1 }}>
              {weeklyQuestion.answer_count}{' '}
              {weeklyQuestion.answer_count === 1 ? 'respuesta' : 'respuestas'}
            </Typography>
            <Button
              component={RouterLink}
              to={`/club-de-lectura/${slug}/preguntas/${weeklyQuestion.id}`}
              sx={{ mt: 1.5, color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
            >
              Entrar al debate →
            </Button>
          </Box>
        ) : (
          <Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
              El debate todavía no está disponible
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.75, maxWidth: 480 }}>
              {nextMission
                ? `La primera pregunta se abrirá después de avanzar en la Misión ${nextMission.order}. Completa tu lectura para entrar al debate.`
                : 'Cuando el mentor abra la primera pregunta de debate, aparecerá aquí.'}
            </Typography>
            {nextMission && !nextMission.locked && (
              <Button
                component={RouterLink}
                to={missionHref}
                sx={{ mt: 1.5, color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
              >
                Completar mi lectura →
              </Button>
            )}
          </Box>
        )}
        {club.can_manage && (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', mt: 2 }}>
            ¿Quieres abrir un debate? Hazlo desde{' '}
            <Box component={RouterLink} to="preguntas" sx={{ color: CLUB_ACCENT }}>
              Debates
            </Box>
            .
          </Typography>
        )}
      </Box>

      {/* Nivel 2 — Mi cuaderno */}
      <Box>
        <SectionLabel>Mi cuaderno</SectionLabel>
        {notebook.notes.length ? (
          <Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {notesStats.idea} ideas · {notesStats.reflection} reflexiones · {notesStats.quote}{' '}
              citas · {notesStats.question} preguntas
            </Typography>
            {lastNote && (
              <Typography
                sx={{
                  mt: 1.5,
                  fontStyle: 'italic',
                  color: 'rgba(255,255,255,0.85)',
                  maxWidth: 480,
                }}
              >
                “{lastNote.body.length > 160 ? `${lastNote.body.slice(0, 157)}…` : lastNote.body}”
              </Typography>
            )}
            <Button
              component={RouterLink}
              to="cuaderno"
              sx={{ mt: 1.5, color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
            >
              Abrir mi cuaderno →
            </Button>
          </Box>
        ) : (
          <Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)' }}>
              Aquí vivirán tus ideas sobre este libro.
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', mt: 0.75, maxWidth: 480 }}>
              Guarda citas, preguntas y reflexiones mientras lees. Es tu espacio personal dentro del
              club.
            </Typography>
            <Button
              component={RouterLink}
              to="cuaderno"
              sx={{ mt: 1.5, color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
            >
              Empezar mi cuaderno →
            </Button>
          </Box>
        )}
      </Box>

      {/* Nivel 2 — Próximo encuentro */}
      <Box>
        <SectionLabel>Próximo encuentro</SectionLabel>
        {hub.next_event && !hub.next_event.is_past ? (
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {hub.next_event.title}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.65)', mt: 0.5 }}>
              {formatClubDate(hub.next_event.date_start, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              }) || 'Fecha por confirmar'}
              {daysToEvent != null && daysToEvent >= 0
                ? ` · en ${daysToEvent} día${daysToEvent === 1 ? '' : 's'}`
                : ''}
            </Typography>
            <Button
              component={RouterLink}
              to={`/events/${hub.next_event.event_id}`}
              sx={{ mt: 1.5, color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
            >
              Ver encuentro →
            </Button>
          </Box>
        ) : (
          <Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)' }}>
              El próximo encuentro vivo aún no está en el calendario.
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', mt: 0.75 }}>
              Mientras tanto, avanza en tu misión y deja una huella en el debate o en tu cuaderno.
            </Typography>
            <Button
              component={RouterLink}
              to="reuniones"
              sx={{ mt: 1.5, color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
            >
              Ver reuniones →
            </Button>
          </Box>
        )}
      </Box>

      {/* Nivel 3 — Actividad */}
      <Box>
        <SectionLabel>Actividad del club</SectionLabel>
        {hub.recent_activity?.length ? (
          <Stack spacing={1.5}>
            {hub.recent_activity.slice(0, 5).map((item) => (
              <Typography
                key={`${item.type}-${item.comment_id}`}
                variant="body2"
                sx={{ color: 'rgba(255,255,255,0.8)' }}
              >
                <strong>{item.author}</strong> {activityLabel(item)}
                {item.body_preview ? `: “${item.body_preview.slice(0, 80)}${item.body_preview.length > 80 ? '…' : ''}”` : ''}
              </Typography>
            ))}
            <Button
              component={RouterLink}
              to="comunidad"
              sx={{ alignSelf: 'flex-start', color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
            >
              Ver comunidad →
            </Button>
          </Stack>
        ) : (
          <Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
              La conversación está por comenzar
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', mt: 0.75, maxWidth: 480 }}>
              Cuando los lectores compartan sus primeras reflexiones, aparecerán aquí.
            </Typography>
            {nextMission && !nextMission.locked && (
              <Button
                component={RouterLink}
                to={missionHref}
                sx={{ mt: 1.5, color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
              >
                Sé de los primeros en completar la Misión {nextMission.order} →
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* Acerca del club — secundario */}
      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: 3 }}>
        <Button
          onClick={() => setAboutOpen((v) => !v)}
          sx={{ color: 'rgba(255,255,255,0.55)', px: 0 }}
        >
          {aboutOpen ? 'Ocultar acerca del club' : 'Acerca del club'}
        </Button>
        <Collapse in={aboutOpen}>
          <Typography sx={{ color: 'rgba(255,255,255,0.65)', mt: 1.5, whiteSpace: 'pre-wrap' }}>
            {club.description || 'Sin descripción adicional.'}
          </Typography>
          {(club.starts_at || club.ends_at) && (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', mt: 1 }}>
              {club.starts_at ? `Inicio: ${formatClubDate(club.starts_at)}` : ''}
              {club.starts_at && club.ends_at ? ' · ' : ''}
              {club.ends_at ? `Cierre: ${formatClubDate(club.ends_at)}` : ''}
            </Typography>
          )}
        </Collapse>
      </Box>
    </Stack>
  );
};

export default BookClubOverview;
