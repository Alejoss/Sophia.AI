import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useBookClub } from './BookClubLayout';
import { CLUB_ACCENT, CLUB_ACCENT_HOVER, formatClubDate } from './clubTheme';

const BookClubCommunity = () => {
  const { hub } = useBookClub();
  const topicId = hub.quick_links?.topic_id;
  const communityActivity = (hub.recent_activity || []).filter((a) => a.type !== 'discussion_answer');

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Comunidad
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.65)' }}>
          Conversación abierta del ciclo: ideas, lecturas compartidas y comentarios fuera del debate guiado.
        </Typography>
      </Box>

      {!topicId ? (
        <Alert severity="info" sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' }}>
          Este club todavía no tiene un topic de comunidad vinculado. El equipo lo asignará desde el panel
          de administración.
        </Alert>
      ) : (
        <Box
          sx={{
            p: 3,
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 1,
            background: 'linear-gradient(135deg, rgba(255,107,53,0.1), rgba(255,255,255,0.02))',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Espacio del club
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
            Entra al topic para seguir hilos, compartir recursos y conversar con el resto del grupo.
          </Typography>
          <Button
            variant="contained"
            component={RouterLink}
            to={`/content/topics/${topicId}`}
            sx={{ bgcolor: CLUB_ACCENT, '&:hover': { bgcolor: CLUB_ACCENT_HOVER } }}
          >
            Ir a la comunidad
          </Button>
        </Box>
      )}

      <Box>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Eco reciente
        </Typography>
        {communityActivity.length ? (
          <Stack spacing={1.5}>
            {communityActivity.map((item) => (
              <Box key={`c-${item.comment_id}`}>
                <Typography variant="body2">
                  <strong>{item.author}</strong>: {item.body_preview}
                  {item.body_preview?.length >= 120 ? '…' : ''}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                  {formatClubDate(item.created_at)}
                </Typography>
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>
            Aún no hay actividad de comunidad. Cuando el topic esté activo, aquí verás un anticipo.
          </Typography>
        )}
      </Box>
    </Stack>
  );
};

export default BookClubCommunity;
