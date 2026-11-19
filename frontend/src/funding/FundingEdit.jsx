import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { DesktopDatePicker } from '@mui/x-date-pickers/DesktopDatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import pathFundingApi from '../api/pathFundingApi';
import ImageUploadModal from '../components/ImageUploadModal';
import { getUserFromLocalStorage } from '../context/localStorageUtils';
import { useDateLocales } from '../hooks/useDateLocales';
import i18n from '../i18n';
import { deadlineWithTimezone } from './FundingCreate';
import { isValidCashAddr } from './cashaddr';
import { coverObjectPosition } from './coverImage';

const SATS_PER_BCH = 100_000_000;

function endOfSelectedDay(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 0, 0);
}

function editSchema(locked) {
  return yup.object({
    title: yup
      .string()
      .trim()
      .required(() => i18n.t('paths:common.titleRequired'))
      .max(200, () => i18n.t('paths:funding.validation.titleTooLong')),
    pitch: yup
      .string()
      .trim()
      .required(() => i18n.t('paths:funding.validation.pitchRequired')),
    goal_sats: locked
      ? yup.string()
      : yup
        .string()
        .trim()
        .required(() => i18n.t('paths:funding.validation.goalRequired'))
        .matches(/^[1-9]\d*$/, () => i18n.t('paths:funding.validation.goalInvalid')),
    deadline: locked
      ? yup.string()
      : yup
        .string()
        .required(() => i18n.t('paths:funding.validation.deadlineRequired'))
        .test(
          'future',
          () => i18n.t('paths:funding.validation.deadlineFuture'),
          (value) => {
            const end = endOfSelectedDay(value);
            return end != null && end.getTime() > Date.now();
          },
        ),
    payout: yup.string(),
  });
}

const FundingEditForm = ({ proposal, onSaved }) => {
  const { t } = useTranslation('paths');
  const { dayjs: dayjsLocale } = useDateLocales();
  const locked = proposal.status !== 'draft';
  const initialDate = dayjs(proposal.deadline);
  const [deadlineValue, setDeadlineValue] = useState(initialDate.isValid() ? initialDate : null);
  const [generalError, setGeneralError] = useState('');
  const [notice, setNotice] = useState('');
  const [usdPerBch, setUsdPerBch] = useState(null);
  const [coverOpen, setCoverOpen] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(editSchema(locked)),
    defaultValues: {
      title: proposal.title || '',
      pitch: proposal.pitch || '',
      goal_sats: String(proposal.goal_sats || ''),
      deadline: initialDate.isValid() ? initialDate.format('YYYY-MM-DD') : '',
      payout: proposal.author_payout_address || '',
    },
  });
  const goalSats = watch('goal_sats');

  useEffect(() => {
    let active = true;
    pathFundingApi.getBchUsdRate()
      .then((rate) => {
        const value = Number(rate?.usd_per_bch);
        if (active && Number.isFinite(value) && value > 0) setUsdPerBch(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const goalHelper = () => {
    if (locked) return t('funding.editChainLocked');
    if (errors.goal_sats?.message) return errors.goal_sats.message;
    const sats = String(goalSats || '').trim();
    if (!/^[1-9]\d*$/.test(sats) || !usdPerBch) return t('funding.goalHelp');
    const usd = (Number(sats) / SATS_PER_BCH) * usdPerBch;
    const formatted = new Intl.NumberFormat(i18n.language === 'en' ? 'en-US' : 'es-ES', {
      style: 'currency',
      currency: 'USD',
    }).format(usd);
    return t('funding.goalUsd', { amount: formatted });
  };

  const saveCover = async (payload) => {
    setGeneralError('');
    setNotice('');
    try {
      const updated = await pathFundingApi.updateProposal(proposal.id, payload);
      onSaved(updated);
      setNotice(t('funding.saved'));
    } catch (err) {
      setGeneralError(err?.response?.data?.error || t('funding.saveError'));
    }
  };

  const onSubmit = async (form) => {
    setGeneralError('');
    setNotice('');
    const payload = {
      title: form.title.trim(),
      pitch: form.pitch.trim(),
    };
    if (!locked) {
      const prefix = proposal.network_prefix || 'bitcoincash';
      const payout = form.payout.trim();
      if (payout && (!isValidCashAddr(payout) || !payout.toLowerCase().startsWith(`${prefix}:`))) {
        setGeneralError(t('funding.payoutNetwork', { prefix }));
        return;
      }
      payload.goal_sats = Number(form.goal_sats);
      payload.deadline = deadlineWithTimezone(form.deadline);
      payload.author_payout_address = payout;
    }
    try {
      const updated = await pathFundingApi.updateProposal(proposal.id, payload);
      onSaved(updated);
      setNotice(t('funding.saved'));
    } catch (err) {
      setGeneralError(err?.response?.data?.error || t('funding.saveError'));
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
        {t('funding.editTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        {locked ? t('funding.editHelpOpen') : t('funding.editHelpDraft')}
      </Typography>
      <Card variant="outlined">
        <CardContent>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              {generalError && <Alert severity="error">{generalError}</Alert>}
              {notice && <Alert severity="success">{notice}</Alert>}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }}>
                <Box
                  sx={{
                    width: { xs: '100%', sm: 280 },
                    height: 158,
                    borderRadius: 2,
                    bgcolor: 'grey.300',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {proposal.image ? (
                    <Box
                      component="img"
                      src={proposal.image}
                      alt={proposal.title || t('edit.coverAlt')}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: coverObjectPosition(proposal.image_focal_x, proposal.image_focal_y),
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '3rem',
                        color: 'text.secondary',
                        fontWeight: 700,
                      }}
                    >
                      {(proposal.title || 'K').charAt(0).toUpperCase()}
                    </Box>
                  )}
                </Box>
                <Box>
                  <Button
                    variant="outlined"
                    startIcon={<PhotoCameraIcon />}
                    onClick={() => setCoverOpen(true)}
                    sx={{ textTransform: 'none', borderRadius: 2, mb: 1 }}
                  >
                    {t('edit.changeCover')}
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {t('edit.coverHint')}
                  </Typography>
                </Box>
              </Stack>
              <TextField
                label={t('common.title')}
                {...register('title')}
                error={Boolean(errors.title)}
                helperText={errors.title?.message || ''}
                placeholder={t('funding.titlePlaceholder')}
                fullWidth
                autoFocus
              />
              <TextField
                label={t('funding.pitch')}
                {...register('pitch')}
                error={Boolean(errors.pitch)}
                helperText={errors.pitch?.message || ''}
                placeholder={t('funding.pitchPlaceholder')}
                multiline
                minRows={4}
                fullWidth
              />
              <TextField
                label={t('funding.goal')}
                {...register('goal_sats')}
                error={Boolean(errors.goal_sats)}
                helperText={goalHelper()}
                inputMode="numeric"
                fullWidth
                disabled={locked}
              />
              <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={dayjsLocale}>
                <Controller
                  name="deadline"
                  control={control}
                  render={({ field }) => (
                    <DesktopDatePicker
                      label={t('funding.deadline')}
                      value={deadlineValue}
                      disabled={locked}
                      onChange={(value) => {
                        setDeadlineValue(value);
                        field.onChange(value?.isValid() ? value.format('YYYY-MM-DD') : '');
                      }}
                      disablePast={!locked}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: Boolean(errors.deadline),
                          helperText: locked
                            ? t('funding.editChainLocked')
                            : (errors.deadline?.message || t('funding.deadlineHelp')),
                          onBlur: field.onBlur,
                        },
                      }}
                    />
                  )}
                />
              </LocalizationProvider>
              <TextField
                label={t('funding.payout')}
                {...register('payout')}
                helperText={locked ? t('funding.editChainLocked') : t('funding.payoutHelp')}
                fullWidth
                disabled={locked}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button type="submit" variant="contained" disabled={isSubmitting}>
                  {isSubmitting ? t('common.saving') : t('funding.save')}
                </Button>
                <Button
                  component={RouterLink}
                  to={`/knowledge_path/funding/${proposal.id}`}
                  variant="contained"
                  color="inherit"
                  disabled={isSubmitting}
                >
                  {t('funding.editBack')}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </CardContent>
      </Card>
      <ImageUploadModal
        open={coverOpen}
        handleClose={() => setCoverOpen(false)}
        handleImageUpload={(file, focalX, focalY) => saveCover({
          image: file,
          image_focal_x: focalX,
          image_focal_y: focalY,
        })}
        existingImageUrl={proposal.image}
        existingFocalX={proposal.image_focal_x ?? 0.5}
        existingFocalY={proposal.image_focal_y ?? 0.5}
        onFocalOnlyUpdate={(focalX, focalY) => saveCover({
          image_focal_x: focalX,
          image_focal_y: focalY,
        })}
        entityLabel={t('funding.coverEntity')}
      />
    </Container>
  );
};

const FundingEdit = () => {
  const { proposalId } = useParams();
  const { t } = useTranslation('paths');
  const user = getUserFromLocalStorage();
  const [proposal, setProposal] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    pathFundingApi.getProposal(proposalId).then((data) => {
      if (active) setProposal(data);
    }).catch(() => {
      if (active) setError(t('funding.loadError'));
    });
    return () => {
      active = false;
    };
  }, [proposalId, t]);

  if (!proposal) {
    return (
      <Container sx={{ py: 3 }}>
        {error && <Alert severity="error">{error}</Alert>}
      </Container>
    );
  }

  if (user?.username !== proposal.author) {
    return (
      <Container sx={{ py: 3 }}>
        <Stack spacing={2}>
          <Typography>{t('funding.editOwnerOnly')}</Typography>
          <Button component={RouterLink} to={`/knowledge_path/funding/${proposal.id}`} sx={{ alignSelf: 'flex-start' }}>
            {t('funding.editBack')}
          </Button>
        </Stack>
      </Container>
    );
  }

  return <FundingEditForm proposal={proposal} onSaved={setProposal} />;
};

export default FundingEdit;
