import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import bookClubsApi from '../api/bookClubsApi';
import { useBookClub } from './BookClubLayout';
import { CLUB_ACCENT, CLUB_ACCENT_HOVER } from './clubTheme';

const BookClubCommunity = () => {
  const { hub, club, slug, canParticipate } = useBookClub();
  const topicId = hub.quick_links?.topic_id;
  const telegramUrl = club?.telegram_group_url;
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(canParticipate);
  const [membersError, setMembersError] = useState('');

  useEffect(() => {
    if (!canParticipate) {
      setMembers([]);
      setMembersLoading(false);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    bookClubsApi
      .listMembers(slug)
      .then((data) => {
        if (!cancelled) {
          setMembers(data);
          setMembersError('');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMembersError(
            err?.response?.data?.detail ||
              'No se pudieron cargar los miembros.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, canParticipate]);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Comunidad
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
          Conversación del ciclo: Telegram para el día a día. La investigación y la línea de tiempo
          del tema están en la pestaña Investigación.
        </Typography>
      </Box>

      {telegramUrl ? (
        <Box
          sx={{
            p: 3,
            border: `1px solid ${CLUB_ACCENT}`,
            borderRadius: 1,
            bgcolor: 'rgba(255,107,53,0.08)',
          }}
        >
          <Typography variant="overline" sx={{ color: CLUB_ACCENT, fontWeight: 700 }}>
            Telegram
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5, mb: 1 }}>
            Grupo del club
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
            Avisos, dudas rápidas y compañía mientras lees. Es el canal vivo del ciclo.
          </Typography>
          <Button
            variant="contained"
            component="a"
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ bgcolor: CLUB_ACCENT, '&:hover': { bgcolor: CLUB_ACCENT_HOVER } }}
          >
            Abrir grupo de Telegram
          </Button>
        </Box>
      ) : (
        <Alert severity="info" sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' }}>
          Aún no hay un grupo de Telegram vinculado a este club.
        </Alert>
      )}

      <Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Miembros del club
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)' }}>
              Conoce a las personas con quienes estás leyendo.
            </Typography>
          </Box>
          {canParticipate && (
            <Button
              component={RouterLink}
              to={`/club-de-lectura/${slug}/presentate`}
              sx={{ color: CLUB_ACCENT, fontWeight: 700 }}
            >
              Editar mi presentación
            </Button>
          )}
        </Stack>

        {!canParticipate ? (
          <Alert severity="info" sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' }}>
            Crea tu cuenta y únete al club para conocer a los demás miembros.
          </Alert>
        ) : membersLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} sx={{ color: CLUB_ACCENT }} />
          </Box>
        ) : membersError ? (
          <Alert severity="error">{membersError}</Alert>
        ) : members.length === 0 ? (
          <Alert severity="info" sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' }}>
            Todavía nadie se ha presentado. Sé el primero con «Editar mi presentación».
          </Alert>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              gap: 2,
            }}
          >
            {members.map((member) => (
              <Box
                key={member.id}
                sx={{
                  p: 2.5,
                  border: member.is_me
                    ? `1px solid ${CLUB_ACCENT}`
                    : '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 1,
                  bgcolor: member.is_me
                    ? 'rgba(255,107,53,0.06)'
                    : 'rgba(255,255,255,0.025)',
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>
                  @{member.username}
                  {member.is_me ? ' · Tú' : ''}
                </Typography>
                <Typography
                  sx={{
                    color: 'rgba(255,255,255,0.78)',
                    mt: 1.25,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {member.intro_description}
                </Typography>
                {(member.social_url || member.additional_url) && (
                  <Stack direction="row" spacing={2} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                    {member.social_url && (
                      <Button
                        component="a"
                        href={member.social_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        sx={{ color: CLUB_ACCENT, px: 0 }}
                      >
                        Red social ↗
                      </Button>
                    )}
                    {member.additional_url && (
                      <Button
                        component="a"
                        href={member.additional_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        sx={{ color: CLUB_ACCENT, px: 0 }}
                      >
                        Otro link ↗
                      </Button>
                    )}
                  </Stack>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {topicId && (
        <Box
          sx={{
            p: 3,
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.03)',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Investigación del ciclo
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
            La línea de tiempo y el material del tema están en la pestaña Investigación, sin salir del hub.
          </Typography>
          <Button
            variant="contained"
            component={RouterLink}
            to={`/club-de-lectura/${slug}/investigacion`}
            sx={{ bgcolor: CLUB_ACCENT, '&:hover': { bgcolor: CLUB_ACCENT_HOVER } }}
          >
            Ir a Investigación
          </Button>
        </Box>
      )}

    </Stack>
  );
};

export default BookClubCommunity;
