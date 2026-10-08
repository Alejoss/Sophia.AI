import React, { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('bookClubs');
  const { slug, hub, club, isGuest, canParticipate } = useBookClub();
  const guest = getGuestSession(slug);
  const accountCta = {
    label: t('overview.accountCta'),
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
        eyebrow: phase === 'pre' ? t('overview.comingSoon') : t('overview.week', { week: week.weekNum }),
        title: nextMission?.title || club.title,
        body: t('overview.guestBody'),
        cta: accountCta,
      };
    }
    if (phase === 'pre') {
      return {
        eyebrow: daysToStart != null && daysToStart > 0
          ? t('overview.startsIn', { count: daysToStart })
          : t('overview.preparingCycle'),
        title: t('overview.journeyTitle'),
        body:
          pulse.member_count > 1
            ? t('overview.membersJoined', { count: pulse.member_count })
            : t('overview.prepareSoon'),
        cta: { label: t('overview.introduceCta'), to: 'presentate' },
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
        eyebrow: t('overview.cycleDone'),
        title: t('overview.finishedTitle'),
        body: (
          <Trans
            t={t}
            i18nKey="overview.finishedBody"
            components={{
              forum: <Box component={RouterLink} to="foro" sx={hubLinkSx} />,
              research: <Box component={RouterLink} to="investigacion" sx={hubLinkSx} />,
              telegram: <Box component={RouterLink} to="comunidad" sx={hubLinkSx} />,
            }}
          />
        ),
        cta: null,
      };
    }
    if (phase === 'between') {
      return {
        eyebrow: t('overview.onTrack'),
        title: t('overview.whileNext'),
        body: weeklyQuestion
          ? t('overview.forumThoughts')
          : t('overview.communityMeanwhile'),
        cta: weeklyQuestion
          ? {
              label: t('overview.enterForum'),
              to: `/club-de-lectura/${slug}/foro/${weeklyQuestion.id}`,
            }
          : telegramUrl
            ? { label: t('overview.telegramGroup'), to: telegramUrl, external: true }
            : { label: t('overview.viewCommunity'), to: 'comunidad' },
      };
    }
    // active
    if (nextMission && !nextMission.locked) {
      const first = (hub.progress?.completed_nodes || 0) === 0;
      return {
        eyebrow: first
          ? t('overview.weekStart', { week: week.weekNum })
          : t('overview.weekContinue', { week: week.weekNum }),
        title: nextMission.title,
        body:
          nextMission.description?.trim() ||
          t('overview.followMission'),
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
            ? t('overview.startMission', { order: nextMission.order })
            : t('overview.continueMission', { order: nextMission.order }),
          to: missionHref,
        },
      };
    }
    if (nextMission?.locked) {
      const collectiveMessage = nextMission.club_schedule_locked
        ? nextMission.opens_at
          ? t('overview.unlocksAt', {
              date: formatClubDate(nextMission.opens_at, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              }),
            })
          : t('overview.notOnCalendar')
        : t('overview.completePrevious');
      return {
        eyebrow: t('overview.nextMission'),
        title: nextMission.title,
        body: collectiveMessage,
        cta: weeklyQuestion
          ? {
              label: t('overview.enterForum'),
              to: `/club-de-lectura/${slug}/foro/${weeklyQuestion.id}`,
            }
          : { label: t('overview.viewMissions'), to: 'misiones' },
      };
    }
    return {
      eyebrow: t('overview.clubActive'),
      title: t('overview.missionsPreparing'),
      body: t('overview.missionsPreparingBody'),
      cta: { label: t('overview.exploreClub'), to: 'comunidad' },
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
              {t('overview.missionProgress', {
                order: hero.missionMeta.order,
                total: hero.missionMeta.total || '—',
                percent: hero.missionMeta.progressPct,
              })}
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
        <SectionLabel>{t('overview.thisWeek')}</SectionLabel>
        {pulse.member_count ? (
          <>
            <Typography sx={{ fontWeight: 600, mb: 1 }}>
              {t('overview.activeReaders', {
                active: pulse.active_readers_7d || 0,
                members: pulse.member_count,
              })}
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
              {t('overview.pathTogether', { percent: pulse.path_completion_pct || 0 })}
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1.5, color: 'rgba(255,255,255,0.75)' }}>
              <Typography variant="body2">
                {t('overview.finishedMission1', { count: pulse.first_mission_completions })}
              </Typography>
              <Typography variant="body2">
                {t('overview.answersOpen', { count: pulse.total_answers })}
              </Typography>
              <Typography variant="body2">
                {t('overview.activeThreads', { count: pulse.open_debates })}
              </Typography>
            </Stack>
          </>
        ) : (
          <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
            {t('overview.collectiveStarts')}
          </Typography>
        )}
      </Box>

      {/* Nivel 2 — Pregunta de la semana */}
      <Box>
        <SectionLabel>{t('overview.questionOfWeek')}</SectionLabel>
        {weeklyQuestion ? (
          <Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 600, fontStyle: 'italic', maxWidth: 560, lineHeight: 1.4 }}
            >
              “{weeklyQuestion.body}”
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mt: 1 }}>
              {t('overview.answers', { count: weeklyQuestion.answer_count })}
            </Typography>
            <Button
              component={RouterLink}
              to={`/club-de-lectura/${slug}/foro/${weeklyQuestion.id}`}
              sx={{ mt: 1.5, color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
            >
              {canParticipate ? t('overview.enterForum') : t('overview.readQuestion')}
            </Button>
          </Box>
        ) : (
          <Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
              {t('overview.forumUnavailable')}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.75, maxWidth: 480 }}>
              {nextMission
                ? t('overview.forumAfterMission', { order: nextMission.order })
                : t('overview.forumWhenStaff')}
            </Typography>
            {nextMission && !nextMission.locked && (
              <Button
                component={RouterLink}
                to={missionHref}
                sx={{ mt: 1.5, color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
              >
                {t('overview.completeReading')}
              </Button>
            )}
          </Box>
        )}
        {club.can_manage && (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', mt: 2 }}>
            <Trans
              t={t}
              i18nKey="overview.openQuestionPrompt"
              components={{
                forum: <Box component={RouterLink} to="foro" sx={{ color: CLUB_ACCENT }} />,
              }}
            />
          </Typography>
        )}
      </Box>

      {/* Nivel 2 — Grupo de Telegram */}
      {telegramUrl && (
        <Box>
          <SectionLabel>{t('overview.telegramSection')}</SectionLabel>
          <Typography sx={{ color: 'rgba(255,255,255,0.75)' }}>
            {t('overview.telegramBlurb')}
          </Typography>
          <Button
            component="a"
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ mt: 1.5, color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
          >
            {t('overview.joinGroup')}
          </Button>
        </Box>
      )}

      {/* Nivel 2 — Próximo encuentro */}
      <Box>
        <SectionLabel>{t('overview.nextMeeting')}</SectionLabel>
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
              }) || t('dates.unconfirmed')}
              {daysToEvent != null && daysToEvent >= 0
                ? t('overview.inDays', { count: daysToEvent })
                : ''}
            </Typography>
            <Button
              component={RouterLink}
              to={`/events/${hub.next_event.event_id}`}
              sx={{ mt: 1.5, color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
            >
              {t('overview.viewMeeting')}
            </Button>
          </Box>
        ) : (
          <Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)' }}>
              {t('overview.noLiveYet')}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', mt: 0.75 }}>
              {t('overview.meanwhileMission')}
            </Typography>
            <Button
              component={RouterLink}
              to="reuniones"
              sx={{ mt: 1.5, color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
            >
              {t('overview.viewMeetings')}
            </Button>
          </Box>
        )}
      </Box>

      {/* Nivel 3 — Eco reciente (comentarios abiertos del tema vinculado) */}
      <Box>
        <SectionLabel>{t('overview.recentEcho')}</SectionLabel>
        {topicActivity.length ? (
          <Stack spacing={1.5}>
            {topicActivity.slice(0, 5).map((item) => (
              <Box key={`${item.type}-${item.comment_id}`}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  <Trans
                    t={t}
                    i18nKey="overview.commented"
                    values={{ author: item.author }}
                    components={{ strong: <strong /> }}
                  />
                  {item.body_preview
                    ? t('overview.commentPreview', {
                        preview: `${item.body_preview.slice(0, 80)}${item.body_preview.length > 80 ? '…' : ''}`,
                      })
                    : ''}
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
              {t('overview.viewInvestigation')}
            </Button>
          </Stack>
        ) : (
          <Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
              {t('overview.conversationStarting')}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', mt: 0.75, maxWidth: 480 }}>
              {t('overview.commentsWillAppear')}
            </Typography>
            {nextMission && !nextMission.locked && (
              <Button
                component={RouterLink}
                to={missionHref}
                sx={{ mt: 1.5, color: CLUB_ACCENT, fontWeight: 700, px: 0 }}
              >
                {t('overview.beFirst', { order: nextMission.order })}
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
          {t('overview.about')}
        </Button>
      </Box>
    </Stack>
  );
};

export default BookClubOverview;
