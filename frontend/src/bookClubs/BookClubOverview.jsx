import React, { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useBookClub } from './BookClubLayout';
import { CLUB_ACCENT, CLUB_ACCENT_HOVER, formatClubDate } from './clubTheme';
import {
  daysUntil,
  resolveExperiencePhase,
  resolveWeekLabel,
} from './clubExperience';
import { getGuestSession, guestCompleteAccountUrl } from './guestStorage';

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

const PrimaryCta = ({ to, href, children, onClick }) => (
  <Button
    variant="contained"
    component={href ? 'a' : to ? RouterLink : 'button'}
    to={href ? undefined : to}
    href={href}
    target={href ? '_blank' : undefined}
    rel={href ? 'noopener noreferrer' : undefined}
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
  const { slug, hub, club, isGuest, canParticipate } = useBookClub();
  const guest = getGuestSession(slug);
  const accountCta = {
    label: 'Crear cuenta para participar →',
    to: guest?.token
      ? guestCompleteAccountUrl(slug, guest.token)
      : `/profiles/register?next=${encodeURIComponent(`/club-de-lectura/${slug}`)}`,
  };

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
  const daysToStart = daysUntil(club.starts_at);
  const daysToEvent = daysUntil(hub.next_event?.date_start);
  const telegramUrl = club.telegram_group_url;

  // ?club= keeps the "back to club" navigation on knowledge-path pages.
  const missionHref = nextMission
    ? `/knowledge_path/${nextMission.path_id}/nodes/${nextMission.node_id}?club=${encodeURIComponent(slug)}`
    : 'misiones';

  const hero = (() => {
    if (isGuest) {
      return {
        eyebrow: phase === 'pre' ? 'Próximamente' : `Semana ${week.weekNum}`,
        title: nextMission?.title || club.title,
        body:
          'Explora el club en solo lectura. Crea tu cuenta para completar misiones y unirte al foro.',
        cta: accountCta,
      };
    }
    if (phase === 'pre') {
      return {
        eyebrow: daysToStart != null && daysToStart > 0 ? `Comenzamos en ${daysToStart} día${daysToStart === 1 ? '' : 's'}` : 'Estamos preparando el ciclo',
        title: 'Tu viaje de lectura está por empezar',
        body:
          pulse.member_count > 1
            ? `${pulse.member_count} lectores ya se han unido. Presenta quién eres y prepárate para la primera misión.`
            : 'Prepárate: pronto abrimos la primera misión y el foro colectivo.',
        cta: { label: 'Preséntate al club →', to: 'presentate' },
      };
    }
    if (phase === 'finished') {
      const hubLinkSx = {
        color: CLUB_ACCENT,
        fontWeight: 700,
        textDecoration: 'underline',
        textUnderlineOffset: 2,
        '&:hover': { color: CLUB_ACCENT_HOVER },
      };
      return {
        eyebrow: 'Ciclo completado',
        title: 'Terminaste con la lectura, excelente.',
        body: (
          <>
            Ahora visita el{' '}
            <Box component={RouterLink} to="foro" sx={hubLinkSx}>
              Foro
            </Box>
            , o la{' '}
            <Box component={RouterLink} to="investigacion" sx={hubLinkSx}>
              Investigación Abierta
            </Box>
            , y si no lo has hecho, súmate al grupo de{' '}
            <Box component={RouterLink} to="comunidad" sx={hubLinkSx}>
              Telegram
            </Box>
            . Será un gusto conversar.
          </>
        ),
        cta: null,
      };
    }
    if (phase === 'between') {
      return {
        eyebrow: 'Vas al día',
        title: 'Mientras llega lo siguiente…',
        body: weeklyQuestion
          ? 'Descubre qué están pensando otros lectores en el foro abierto.'
          : 'Entra a la comunidad o al grupo de Telegram mientras se abre la próxima misión.',
        cta: weeklyQuestion
          ? {
              label: 'Entrar al foro →',
              to: `/club-de-lectura/${slug}/foro/${weeklyQuestion.id}`,
            }
          : telegramUrl
            ? { label: 'Ir al grupo de Telegram →', to: telegramUrl, external: true }
            : { label: 'Ver comunidad →', to: 'comunidad' },
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
          'Sigue la lectura de esta misión y vuelve al foro.',
        preserveBodyWhitespace: Boolean(nextMission.description?.trim()),
        missionMeta: canParticipate
          ? {
              order: nextMission.order,
              total: hub.progress?.total_nodes || null,
              progressPct,
            }
          : null,
        cta: {
          label: first
            ? `Comenzar misión ${nextMission.order} →`
            : `Continuar misión ${nextMission.order} →`,
          to: missionHref,
        },
      };
    }
    if (nextMission?.locked) {
      const collectiveMessage = nextMission.club_schedule_locked
        ? nextMission.opens_at
          ? `Se desbloquea para todo el club el ${formatClubDate(nextMission.opens_at, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}.`
          : 'El staff todavía no ha definido la fecha de apertura.'
        : 'Completa la misión anterior para continuar.';
      return {
        eyebrow: 'Próxima misión',
        title: nextMission.title,
        body: collectiveMessage,
        cta: weeklyQuestion
          ? {
              label: 'Entrar al foro →',
              to: `/club-de-lectura/${slug}/foro/${weeklyQuestion.id}`,
            }
          : { label: 'Ver misiones →', to: 'misiones' },
      };
    }
    return {
      eyebrow: 'El club está activo',
      title: 'Las misiones se están preparando',
      body: 'Cuando el staff publique la primera lectura, aparecerá aquí como tu acción principal.',
      cta: { label: 'Explorar el club →', to: 'comunidad' },
    };
  })();

  // Only topic comments are public/open; forum answers are gated (post-to-see),
  // so they don't belong in this open feed.
  const topicActivity = (hub.recent_activity || []).filter(
    (item) => item.type === 'topic_comment'
  );

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
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.72)',
            mt: 1.5,
            maxWidth: 560,
            whiteSpace: hero.preserveBodyWhitespace ? 'pre-wrap' : 'normal',
          }}
        >
          {hero.body}
        </Typography>
        {hero.missionMeta && (
          <Box sx={{ mt: 2, maxWidth: 280 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)' }}>
              Misión {hero.missionMeta.order} de {hero.missionMeta.total || '—'} · tu progreso{' '}
              {hero.missionMeta.progressPct}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={hero.missionMeta.progressPct}
              sx={{
                mt: 1,
                height: 6,
                borderRadius: 1,
                bgcolor: 'rgba(255,255,255,0.08)',
                '& .MuiLinearProgress-bar': { bgcolor: CLUB_ACCENT },
              }}
            />
          </Box>
        )}
        {hero.cta && (
          <PrimaryCta
            to={hero.cta.external ? undefined : hero.cta.to}
            href={hero.cta.external ? hero.cta.to : undefined}
          >
            {hero.cta.label}
          </PrimaryCta>
        )}
      </Box>

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
                {pulse.total_answers === 1 ? 'respuesta' : 'respuestas'} en hilos abiertos
              </Typography>
              <Typography variant="body2">
                {pulse.open_debates}{' '}
                {pulse.open_debates === 1 ? 'hilo activo' : 'hilos activos'}
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
              to={`/club-de-lectura/${slug}/foro/${weeklyQuestion.id}`}
              sx={{ mt: 1.5, color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
            >
              {canParticipate ? 'Entrar al foro →' : 'Leer la pregunta →'}
            </Button>
          </Box>
        ) : (
          <Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
              El foro todavía no está disponible
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.75, maxWidth: 480 }}>
              {nextMission
                ? `La primera pregunta se abrirá después de avanzar en la Misión ${nextMission.order}. Completa tu lectura para entrar al foro.`
                : 'Cuando el staff abra la primera pregunta del foro, aparecerá aquí.'}
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
            ¿Quieres abrir una pregunta? Hazlo desde{' '}
            <Box component={RouterLink} to="foro" sx={{ color: CLUB_ACCENT }}>
              Foro
            </Box>
            .
          </Typography>
        )}
      </Box>

      {/* Nivel 2 — Grupo de Telegram */}
      {telegramUrl && (
        <Box>
          <SectionLabel>Grupo de Telegram</SectionLabel>
          <Typography sx={{ color: 'rgba(255,255,255,0.75)' }}>
            Conversación rápida del ciclo: avisos, dudas y compañía mientras lees.
          </Typography>
          <Button
            component="a"
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ mt: 1.5, color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
          >
            Unirme al grupo →
          </Button>
        </Box>
      )}

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
              Mientras tanto, avanza en tu misión y participa en el foro.
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

      {/* Nivel 3 — Eco reciente (comentarios abiertos del tema vinculado) */}
      <Box>
        <SectionLabel>Eco reciente</SectionLabel>
        {topicActivity.length ? (
          <Stack spacing={1.5}>
            {topicActivity.slice(0, 5).map((item) => (
              <Box key={`${item.type}-${item.comment_id}`}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  <strong>{item.author}</strong> comentó en el tema
                  {item.body_preview ? `: “${item.body_preview.slice(0, 80)}${item.body_preview.length > 80 ? '…' : ''}”` : ''}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                  {formatClubDate(item.created_at)}
                </Typography>
              </Box>
            ))}
            <Button
              component={RouterLink}
              to="investigacion"
              sx={{ alignSelf: 'flex-start', color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
            >
              Ver investigación →
            </Button>
          </Stack>
        ) : (
          <Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
              La conversación está por comenzar
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', mt: 0.75, maxWidth: 480 }}>
              Cuando los lectores comenten en el tema de investigación, sus aportes aparecerán aquí.
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

      {/* Enlace secundario al sitio principal */}
      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: 3 }}>
        <Button
          component={RouterLink}
          to="/"
          sx={{ color: 'rgba(255,255,255,0.55)', px: 0 }}
        >
          Acerca de Academia Blockchain
        </Button>
      </Box>
    </Stack>
  );
};

export default BookClubOverview;
