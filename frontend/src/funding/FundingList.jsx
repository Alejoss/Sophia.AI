import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Container, Paper, Stack, Typography } from '@mui/material';
import pathFundingApi from '../api/pathFundingApi';

const FundingList = () => {
  const { t } = useTranslation('paths');
  const [proposals, setProposals] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    pathFundingApi.listProposals()
      .then(setProposals)
      .catch(() => setError(t('funding.loadError')));
  }, [t]);

  return (
    <Container sx={{ py: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">{t('funding.listTitle')}</Typography>
        <Button component={RouterLink} to="/knowledge_path/funding/new" variant="contained">
          {t('funding.create')}
        </Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack spacing={2}>
        {proposals.map((proposal) => (
          <Paper key={proposal.id} sx={{ p: 2 }}>
            <Typography variant="h6">{proposal.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('funding.progress', {
                raised: proposal.raised_sats,
                goal: proposal.goal_sats,
                status: proposal.status,
              })}
            </Typography>
            <Button component={RouterLink} to={`/knowledge_path/funding/${proposal.id}`} sx={{ mt: 1 }}>
              {t('funding.open')}
            </Button>
          </Paper>
        ))}
        {!error && proposals.length === 0 && (
          <Typography color="text.secondary">{t('funding.empty')}</Typography>
        )}
      </Stack>
    </Container>
  );
};

export default FundingList;
