import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { fetchCurrentFeaturedEvent } from '../api/eventsApi';
import { formatEventWhen } from '../utils/dateUtils';
import { useDateLocales } from '../hooks/useDateLocales';

const FeaturedEventBanner = () => {
  const { t } = useTranslation('events');
  const { intl } = useDateLocales();
  const [featured, setFeatured] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentFeaturedEvent()
      .then((data) => {
        if (!cancelled && data?.image && data?.event_id) {
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
    ? formatEventWhen(featured.date_start, featured.date_start_has_time !== false, intl)
    : '';
  const end = featured.date_end
    ? formatEventWhen(featured.date_end, featured.date_end_has_time !== false, intl)
    : '';
  const when = [start, end].filter(Boolean).join(' – ');

  return (
    <Box
      component={RouterLink}
      to={featured.path || `/events/${featured.event_id}`}
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
      <Box
        className="featured-event-banner__image"
        component="img"
        src={featured.image}
        alt=""
        sx={{
          width: '100%',
          aspectRatio: { xs: '12 / 5', md: '1600 / 280' },
          objectFit: 'cover',
          display: 'block',
          transition: 'transform 0.45s ease',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: { xs: 0.5, md: 1.5 },
          px: { xs: 1.5, md: 2.5 },
          py: { xs: 1, md: 1.25 },
          background: 'linear-gradient(transparent, rgba(0,0,0,0.78))',
        }}
      >
        <Typography
          component="span"
          sx={{
            color: '#f5d78e',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          {t('banner.kicker')}
        </Typography>
          <Typography
          component="span"
          sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '0.95rem', md: '1.15rem' } }}
        >
          {featured.title}
        </Typography>
        {when && (
          <Typography component="span" sx={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.85rem' }}>
            {when}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default FeaturedEventBanner;
