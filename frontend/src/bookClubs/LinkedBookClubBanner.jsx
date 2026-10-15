import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import { CLUB_ACCENT, CLUB_BG } from './clubTheme';

/**
 * Discovery banner on knowledge-path detail when the path is linked to one or
 * more Club de Lectura cycles. Copy is path-first ("has a reading club linked"),
 * not a "back to club" return affordance.
 */
const LinkedBookClubBanner = ({ clubs, sx }) => {
  const { t } = useTranslation(['paths', 'bookClubs']);
  const list = Array.isArray(clubs) ? clubs.filter((c) => c?.slug) : [];

  if (!list.length) return null;

  return (
    <Stack spacing={1.5} sx={sx}>
      {list.map((club) => (
        <Box
          key={club.slug}
          sx={{
            bgcolor: CLUB_BG,
            border: `1px solid ${CLUB_ACCENT}`,
            borderRadius: 2,
            px: { xs: 2, sm: 3 },
            py: 2,
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="overline"
                sx={{ color: CLUB_ACCENT, fontWeight: 700, lineHeight: 1.4, display: 'block' }}
              >
                {t('brand', { ns: 'bookClubs' })}
              </Typography>
              <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.5 }}>
                {t('detail.linkedReadingClub')}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.95rem' }}>
                {club.title}
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexShrink={0}>
              <Button
                component={RouterLink}
                to={`/club-de-lectura/${club.slug}`}
                variant="contained"
                startIcon={<MenuBookOutlinedIcon />}
                sx={{
                  bgcolor: CLUB_ACCENT,
                  color: '#1a1310',
                  fontWeight: 700,
                  '&:hover': { bgcolor: '#e8943a' },
                }}
              >
                {t('detail.visitReadingClub')}
              </Button>
              <Button
                component={RouterLink}
                to={`/club-de-lectura/${club.slug}/foro`}
                variant="outlined"
                startIcon={<ForumOutlinedIcon />}
                sx={{
                  borderColor: CLUB_ACCENT,
                  color: CLUB_ACCENT,
                  fontWeight: 700,
                  '&:hover': {
                    borderColor: '#e8943a',
                    bgcolor: 'rgba(244, 162, 89, 0.08)',
                  },
                }}
              >
                {t('detail.visitReadingClubForum')}
              </Button>
            </Stack>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
};

export default LinkedBookClubBanner;
