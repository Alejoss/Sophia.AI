import { useContext, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material';
import pathFundingApi from '../api/pathFundingApi';
import { AuthContext } from '../context/AuthContext';

const FundingList = () => {
  const { t } = useTranslation('paths');
  const { authState, authInitialized } = useContext(AuthContext);
  const [proposals, setProposals] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
          <Paper key={proposal.id} sx={{ p: 2 }}>
            <Typography variant="h6">{proposal.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('funding.progress', {
                raised: proposal.raised_sats,
                goal: proposal.goal_sats,
                status: t(`funding.statuses.${proposal.status}`, { defaultValue: proposal.status }),
              })}
            </Typography>
            <Button component={RouterLink} to={`/knowledge_path/funding/${proposal.id}`} sx={{ mt: 1 }}>
              {t('funding.open')}
            </Button>
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
