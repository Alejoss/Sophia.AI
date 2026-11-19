import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
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
import pathFundingApi from '../api/pathFundingApi';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';
import { useDateLocales } from '../hooks/useDateLocales';
import i18n from '../i18n';

const SATS_PER_BCH = 100_000_000;

const schema = yup.object({
  title: yup
    .string()
    .trim()
    .required(() => i18n.t('paths:common.titleRequired'))
    .max(200, () => i18n.t('paths:funding.validation.titleTooLong')),
  pitch: yup
    .string()
    .trim()
    .required(() => i18n.t('paths:funding.validation.pitchRequired')),
  goal_sats: yup
    .string()
    .trim()
    .required(() => i18n.t('paths:funding.validation.goalRequired'))
    .matches(/^[1-9]\d*$/, () => i18n.t('paths:funding.validation.goalInvalid')),
  deadline: yup
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
});

const defaultValues = {
  title: '',
  pitch: '',
  goal_sats: '12000000',
  deadline: '',
};

function endOfSelectedDay(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 0, 0);
}

export function deadlineWithTimezone(value) {
  const date = endOfSelectedDay(value);
  if (!date) return '';
  const pad = (part) => String(part).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const hours = pad(Math.floor(Math.abs(offset) / 60));
  const minutes = pad(Math.abs(offset) % 60);
  const local = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-');
  const time = [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(':');
  return `${local}T${time}${sign}${hours}:${minutes}`;
}

const FundingCreate = () => {
  const { t } = useTranslation('paths');
  const { dayjs: dayjsLocale } = useDateLocales();
  const navigate = useNavigate();
  const [generalError, setGeneralError] = useState(null);
  const [deadlineValue, setDeadlineValue] = useState(null);
  const [usdPerBch, setUsdPerBch] = useState(null);
  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues,
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

  const onSubmit = async (form) => {
    setGeneralError(null);
    try {
      const created = await pathFundingApi.createProposal({
        title: form.title.trim(),
        pitch: form.pitch.trim(),
        goal_sats: Number(form.goal_sats),
        deadline: deadlineWithTimezone(form.deadline),
      });
      navigate(`/knowledge_path/funding/${created.id}`);
    } catch (err) {
      const { generalError: parsed } = applyApiErrorsToForm(
        err,
        setError,
        t('funding.saveError'),
      );
      if (parsed) setGeneralError(parsed);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
        {t('funding.createTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        {t('funding.createHelp')}
      </Typography>

      <Card variant="outlined">
        <CardContent>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              {generalError && (
                <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>
                  {generalError}
                </Alert>
              )}
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
              />
              <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={dayjsLocale}>
                <Controller
                  name="deadline"
                  control={control}
                  render={({ field }) => (
                    <DesktopDatePicker
                      label={t('funding.deadline')}
                      value={deadlineValue}
                      onChange={(value) => {
                        setDeadlineValue(value);
                        field.onChange(value?.isValid() ? value.format('YYYY-MM-DD') : '');
                      }}
                      disablePast
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: Boolean(errors.deadline),
                          helperText: errors.deadline?.message || t('funding.deadlineHelp'),
                          onBlur: field.onBlur,
                        },
                      }}
                    />
                  )}
                />
              </LocalizationProvider>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button type="submit" variant="contained" disabled={isSubmitting}>
                  {isSubmitting ? t('common.saving') : t('funding.saveDraft')}
                </Button>
                <Button
                  type="button"
                  variant="contained"
                  color="inherit"
                  disabled={isSubmitting}
                  onClick={() => navigate('/knowledge_path/funding')}
                >
                  {t('common.cancel')}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};

export default FundingCreate;
