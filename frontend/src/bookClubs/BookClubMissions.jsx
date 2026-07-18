import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import { useBookClub } from './BookClubLayout';
import { CLUB_ACCENT, CLUB_ACCENT_HOVER } from './clubTheme';
import { getGuestSession, guestCompleteAccountUrl } from './guestStorage';

const BookClubMissions = () => {
  const { slug, hub, isGuest, canParticipate } = useBookClub();
  const progressPct = Math.round(hub.progress?.percentage || 0);
  const pathId = hub.quick_links?.knowledge_path_id;
  const next = hub.next_mission;
  const readOnly = isGuest || !canParticipate;
  const guest = getGuestSession(slug);
  const accountUrl = guest?.token
    ? guestCompleteAccountUrl(slug, guest.token)
    : `/profiles/register?next=${encodeURIComponent(`/club-de-lectura/${slug}`)}`;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Misiones
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
          El knowledge path del club es la secuencia de lecturas y ejercicios del ciclo.
        </Typography>
      </Box>

      {readOnly && (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" component={RouterLink} to={accountUrl} sx={{ fontWeight: 700 }}>
              Crear cuenta
            </Button>
          }
          sx={{ bgcolor: 'rgba(255,107,53,0.1)', color: '#fff', border: '1px solid rgba(255,107,53,0.35)' }}
        >
          Puedes ver el resumen de misiones. Para abrirlas y marcar progreso, crea tu cuenta.
        </Alert>
      )}

      <Box
        sx={{
          p: 2.5,
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 1,
        }}
      >
        <Typography sx={{ color: 'rgba(255,255,255,0.85)', mb: 1 }}>
          {hub.progress.completed_nodes} de {hub.progress.total_nodes} misiones · {progressPct}%
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progressPct}
          sx={{
            height: 10,
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.08)',
            '& .MuiLinearProgress-bar': { bgcolor: CLUB_ACCENT },
          }}
        />
      </Box>

      {next ? (
        <Box
          sx={{
            p: 2.5,
            border: `1px solid ${CLUB_ACCENT}`,
            borderRadius: 1,
            bgcolor: 'rgba(255,107,53,0.06)',
          }}
        >
          <Typography variant="overline" sx={{ color: CLUB_ACCENT, fontWeight: 700 }}>
            Siguiente
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
            Misión {next.order}: {next.title}
          </Typography>
          {readOnly ? (
            <Button
              variant="contained"
              component={RouterLink}
              to={accountUrl}
              sx={{ mt: 2, bgcolor: CLUB_ACCENT, '&:hover': { bgcolor: CLUB_ACCENT_HOVER } }}
            >
              Crear cuenta para abrir
            </Button>
          ) : next.locked ? (
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', mt: 1 }}>
              Esta misión está bloqueada hasta completar la anterior.
            </Typography>
          ) : (
            <Button
              variant="contained"
              component={RouterLink}
              to={`/knowledge_path/${next.path_id}/nodes/${next.node_id}`}
              sx={{ mt: 2, bgcolor: CLUB_ACCENT, '&:hover': { bgcolor: CLUB_ACCENT_HOVER } }}
            >
              Abrir misión
            </Button>
          )}
        </Box>
      ) : hub.progress.is_completed ? (
        <Alert severity="success">Completaste todas las misiones de este ciclo. Usa el Foro o Comunidad mientras llega el siguiente.</Alert>
      ) : (
        <Box>
          <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
            Las misiones se están preparando
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.75 }}>
            Cuando el mentor publique la primera lectura, aparecerá aquí como tu acción principal.
          </Typography>
        </Box>
      )}

      {pathId && !readOnly && (
        <Button
          variant="outlined"
          component={RouterLink}
          to={`/knowledge_path/${pathId}`}
          sx={{ alignSelf: 'flex-start', borderColor: CLUB_ACCENT, color: CLUB_ACCENT }}
        >
          Ver path completo
        </Button>
      )}
    </Stack>
  );
};

export default BookClubMissions;
