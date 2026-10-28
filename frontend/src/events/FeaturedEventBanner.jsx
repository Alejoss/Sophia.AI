import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { fetchCurrentFeaturedEvent } from '../api/eventsApi';
import { formatEventWhen } from '../utils/dateUtils';
import { useDateLocales } from '../hooks/useDateLocales';

/** Matches the MUI `md` breakpoint where the banner switches to its 1600 × 280 shape. */
const MOBILE_MEDIA = '(max-width: 899.95px)';

const FeaturedEventBanner = () => {
  const { intl } = useDateLocales();
  const [featured, setFeatured] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentFeaturedEvent()
      .then((data) => {
        if (!cancelled && data?.desktop_image && data?.mobile_image && data?.event_id) {
          setFeatured(data);
        }
      })
      .catch(() => {
        if (!cancelled) setFeatured(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!featured) return null;

  const start = featured.date_start
    ? formatEventWhen(featured.date_start, featured.date_start_has_time !== false, intl, { month: 'short' })
    : '';
  const end = featured.date_end
    ? formatEventWhen(featured.date_end, featured.date_end_has_time !== false, intl, { month: 'short' })
    : '';
  const when = [start, end].filter(Boolean).join(' – ');

  return (
    <Box
      component={RouterLink}
      to={featured.path || `/events/${featured.event_id}`}
      aria-label={when ? `${featured.title} · ${when}` : featured.title}
      sx={{
        position: 'relative',
        display: 'block',
        mb: 3,
        borderRadius: 2,
        overflow: 'hidden',
        lineHeight: 0,
        textDecoration: 'none',
        color: 'inherit',
        backgroundColor: '#12141c',
        '&:hover .featured-event-banner__image': {
          transform: 'scale(1.015)',
        },
      }}
    >
      <Box component="picture" sx={{ display: 'block' }}>
        <source media={MOBILE_MEDIA} srcSet={featured.mobile_image} />
        <Box
          className="featured-event-banner__image"
          component="img"
          src={featured.desktop_image}
          alt=""
          sx={{
            width: '100%',
            aspectRatio: { xs: '12 / 5', md: '1600 / 280' },
            objectFit: 'cover',
            display: 'block',
            transition: 'transform 0.45s ease',
          }}
        />
      </Box>
      {when && (
        <Typography
          component="span"
          aria-hidden="true"
          sx={{
            position: 'absolute',
            top: { xs: 6, md: 10 },
            right: { xs: 6, md: 10 },
            px: 1,
            py: 0.25,
            borderRadius: 1,
            lineHeight: 1.5,
            fontSize: { xs: '0.7rem', md: '0.78rem' },
            fontWeight: 600,
            color: '#fff',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            whiteSpace: 'nowrap',
          }}
        >
          {when}
        </Typography>
      )}
    </Box>
  );
};

export default FeaturedEventBanner;
