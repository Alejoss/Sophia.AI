import { Box, Button, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const SLIDES = 'https://docs.google.com/presentation/d/1Yfuk9CJkf4U9M_WukcELhumWgj3Ak6345Ewy8hSp-Hk/edit?usp=sharing';
const REPO = 'https://github.com/Alejoss/Sophia.AI';

const BlazeBanner = () => {
  const { t } = useTranslation('paths');
  const emberAddress = import.meta.env.VITE_BLAZE_EMBER_ADDRESS || '';

  return (
    <Box
      sx={{
        mb: 3,
        p: { xs: 2, md: 3 },
        borderRadius: 2,
        color: '#f7f1e1',
        background: 'linear-gradient(135deg, #1c140c 0%, #6b2d12 55%, #e07a2f 100%)',
      }}
    >
      <Stack spacing={1.5}>
        <Typography variant="overline" sx={{ letterSpacing: 1.4, color: '#ffd7a8' }}>
          BCH BLAZE 2026
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff8ee' }}>
          {t('funding.bannerTitle')}
        </Typography>
        <Typography variant="body2" sx={{ maxWidth: 760, color: '#fff4e5' }}>
          {t('funding.bannerBody')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <Button component={RouterLink} to="/knowledge_path/funding" variant="contained" color="inherit" sx={{ color: '#3b1d0a' }}>
            {t('funding.viewCampaigns')}
          </Button>
          <Link href={SLIDES} target="_blank" rel="noreferrer" sx={{ color: '#fff8ee' }}>
            {t('funding.slides')}
          </Link>
          <Link href={REPO} target="_blank" rel="noreferrer" sx={{ color: '#fff8ee' }}>
            {t('funding.repo')}
          </Link>
        </Stack>
        <Typography variant="body2" sx={{ wordBreak: 'break-all', color: '#ffe7c2' }}>
          {emberAddress
            ? t('funding.ember', { address: emberAddress })
            : t('funding.emberMissing')}
        </Typography>
      </Stack>
    </Box>
  );
};

export default BlazeBanner;
