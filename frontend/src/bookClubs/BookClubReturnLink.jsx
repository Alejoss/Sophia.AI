import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Box, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import bookClubsApi from '../api/bookClubsApi';
import { CLUB_ACCENT, CLUB_BG } from './clubTheme';

/**
 * "Back to the club" banner for knowledge-path pages reached from a book club
 * (?club=<slug> in the URL). Renders only when the backend confirms the
 * current user is a member (or manager) of that club, so regular
 * knowledge-path visitors never see club UI.
 */
const BookClubReturnLink = ({ sx }) => {
  const [searchParams] = useSearchParams();
  const slug = searchParams.get('club');
  const [club, setClub] = useState(null);

  useEffect(() => {
    if (!slug) {
      setClub(null);
      return undefined;
    }
    let cancelled = false;
    bookClubsApi
      .getClub(slug)
      .then((data) => {
        if (!cancelled && (data?.is_member || data?.can_manage)) {
          setClub(data);
        }
      })
      .catch(() => {
        // Unknown club or no access: simply don't render the banner.
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!club) return null;

  return (
    <Box
      component={RouterLink}
      to={`/club-de-lectura/${slug}`}
      sx={{
        display: 'block',
        textDecoration: 'none',
        bgcolor: CLUB_BG,
        border: `1px solid ${CLUB_ACCENT}`,
        borderRadius: 2,
        px: { xs: 2, sm: 3 },
        py: 1.75,
        transition: 'background-color 160ms ease, transform 160ms ease',
        '&:hover': {
          bgcolor: '#1a1310',
          transform: 'translateY(-1px)',
        },
        ...sx,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <ArrowBackIcon sx={{ color: CLUB_ACCENT }} />
        <Box>
          <Typography
            variant="overline"
            sx={{ color: CLUB_ACCENT, fontWeight: 700, lineHeight: 1.4, display: 'block' }}
          >
            Club de Lectura
          </Typography>
          <Typography sx={{ color: '#fff', fontWeight: 700 }}>
            Volver a «{club.title}»
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
};

export default BookClubReturnLink;
