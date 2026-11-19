import { useContext, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material';
import pathFundingApi from '../api/pathFundingApi';
import { AuthContext } from '../context/AuthContext';
import { formatUsdFromSats, useBchUsdRate } from './goalValue';
import { coverObjectPosition } from './coverImage';

const FundingList = () => {
  const { t, i18n } = useTranslation('paths');
  const { authState, authInitialized } = useContext(AuthContext);
  const [proposals, setProposals] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const usdPerBch = useBchUsdRate();

  useEffect(() => {
    if (!authInitialized) return undefined;
    let cancelled = false;
    setLoading(true);
    pathFundingApi.listProposals({ mine: authState.isAuthenticated })
      .then((data) => {
        if (!cancelled) setProposals(data);
      })
      .catch(() => {
        if (!cancelled) setError(t('funding.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authInitialized, authState.isAuthenticated, t]);

  const goalNote = (goalSats) => {
    const amount = formatUsdFromSats(goalSats, usdPerBch, i18n.language);
    return amount ? ` · ${t('funding.goalValue', { amount })}` : '';
  };

  return (
    <Container sx={{ py: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">{t('funding.listTitle')}</Typography>
        <Button component={RouterLink} to="/knowledge_path/funding/new" variant="contained">
          {t('funding.create')}
        </Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {loading && <CircularProgress size={28} />}
      <Stack spacing={2}>
        {proposals.map((proposal) => (
          <Paper key={proposal.id} sx={{ overflow: 'hidden' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }}>
              {(proposal.image_preview || proposal.image) ? (
                <Box
                  component="img"
                  src={proposal.image_preview || proposal.image}
                  alt={proposal.title}
                  loading="lazy"
                  sx={{
                    width: { xs: '100%', sm: 240 },
                    height: 140,
                    objectFit: 'cover',
                    objectPosition: coverObjectPosition(proposal.image_focal_x, proposal.image_focal_y),
                    flexShrink: 0,
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: { xs: '100%', sm: 240 },
                    height: 140,
                    bgcolor: 'grey.300',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '3rem',
                    color: 'text.secondary',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {(proposal.title || 'K').charAt(0).toUpperCase()}
                </Box>
              )}
              <Box sx={{ p: 2 }}>
                <Typography variant="h6">{proposal.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('funding.progress', {
                    raised: proposal.raised_sats,
                    goal: proposal.goal_sats,
                    goalNote: goalNote(proposal.goal_sats),
                    pendingNote: Number(proposal.pending_sats) > 0
                      ? ` · ${t('funding.pending', { amount: proposal.pending_sats })}`
                      : '',
                    status: t(`funding.statuses.${proposal.status}`, { defaultValue: proposal.status }),
                  })}
                </Typography>
                <Button component={RouterLink} to={`/knowledge_path/funding/${proposal.id}`} sx={{ mt: 1 }}>
                  {t('funding.open')}
                </Button>
              </Box>
            </Stack>
          </Paper>
        ))}
        {!loading && !error && proposals.length === 0 && (
          <Typography color="text.secondary">{t('funding.empty')}</Typography>
        )}
      </Stack>
    </Container>
  );
};

export default FundingList;
