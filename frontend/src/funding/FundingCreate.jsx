import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Container, Stack, TextField, Typography } from '@mui/material';
import pathFundingApi from '../api/pathFundingApi';

function withTimezone(value) {
  const date = new Date(value);
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
  return `${value}:00${sign}${hours}:${minutes}`;
}

const FundingCreate = () => {
  const { t } = useTranslation('paths');
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    pitch: '',
    goal_sats: '30000',
    deadline: '',
    author_payout_address: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await pathFundingApi.createProposal({
        ...form,
        goal_sats: Number(form.goal_sats),
        deadline: withTimezone(form.deadline),
      });
      navigate(`/knowledge_path/funding/${created.id}`);
    } catch (err) {
      setError(err?.response?.data?.error || t('funding.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ mb: 1 }}>{t('funding.createTitle')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('funding.createHelp')}
      </Typography>
      <Stack component="form" spacing={2} onSubmit={submit}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label={t('common.title')} value={form.title} onChange={update('title')} required />
        <TextField label={t('funding.pitch')} value={form.pitch} onChange={update('pitch')} multiline minRows={4} />
        <TextField label={t('funding.goal')} value={form.goal_sats} onChange={update('goal_sats')} required />
        <TextField
          label={t('funding.deadline')}
          type="datetime-local"
          value={form.deadline}
          onChange={update('deadline')}
          InputLabelProps={{ shrink: true }}
          required
          helperText={t('funding.deadlineHelp')}
        />
        <TextField
          label={t('funding.payout')}
          value={form.author_payout_address}
          onChange={update('author_payout_address')}
          required
        />
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? t('common.saving') : t('funding.saveDraft')}
        </Button>
      </Stack>
    </Container>
  );
};

export default FundingCreate;
