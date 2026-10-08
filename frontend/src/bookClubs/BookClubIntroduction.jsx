import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import bookClubsApi from '../api/bookClubsApi';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';
import { useBookClub } from './BookClubLayout';
import {
  CLUB_ACCENT,
  CLUB_ACCENT_HOVER,
  CLUB_TEXT_FIELD_SX,
} from './clubTheme';
import { getGuestSession, guestCompleteAccountUrl } from './guestStorage';

const optionalLink = yup
  .string()
  .trim()
  .transform((value) => value || '')
  .test(
    'url-or-empty',
    () => i18n.t('bookClubs:intro.invalidUrl'),
    (value) => {
      if (!value) return true;
      const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      try {
        return Boolean(new URL(withScheme));
      } catch {
        return false;
      }
    }
  );

const schema = yup.object({
  country: yup.string().trim().max(100, () => i18n.t('bookClubs:intro.max100')),
  intro_description: yup.string().trim().max(1000, () => i18n.t('bookClubs:intro.max1000')),
  social_url: optionalLink,
  additional_url: optionalLink,
});

const BookClubIntroduction = () => {
  const { t } = useTranslation('bookClubs');
  const navigate = useNavigate();
  const { slug, club, isGuest, canParticipate } = useBookClub();
  const [loading, setLoading] = useState(!isGuest);
  const [generalError, setGeneralError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      country: '',
      intro_description: '',
      social_url: '',
      additional_url: '',
    },
  });

  const descriptionLength = (watch('intro_description') || '').length;

  useEffect(() => {
    if (isGuest || !canParticipate) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    bookClubsApi
      .getMemberIntroduction(slug)
      .then((data) => {
        if (!cancelled) {
          reset({
            country: data.country || '',
            intro_description: data.intro_description || '',
            social_url: data.social_url || '',
            additional_url: data.additional_url || '',
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setGeneralError(
            err?.response?.data?.detail || t('errors.loadIntro')
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, isGuest, canParticipate, reset, t]);

  const onSubmit = async (data) => {
    setGeneralError('');
    try {
      await bookClubsApi.updateMemberIntroduction(slug, {
        country: (data.country || '').trim(),
        intro_description: (data.intro_description || '').trim(),
        social_url: (data.social_url || '').trim(),
        additional_url: (data.additional_url || '').trim(),
      });
      navigate(`/club-de-lectura/${slug}/comunidad`, { replace: true });
    } catch (err) {
      const { generalError: parsed } = applyApiErrorsToForm(
        err,
        setError,
        t('errors.saveIntro')
      );
      if (parsed) setGeneralError(parsed);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress sx={{ color: CLUB_ACCENT }} />
      </Box>
    );
  }

  if (isGuest || !canParticipate) {
    const guest = getGuestSession(slug);
    const createAccountUrl = guest?.token
      ? guestCompleteAccountUrl(slug, guest.token)
      : `/profiles/register?next=${encodeURIComponent(
          `/club-de-lectura/${slug}/presentate`
        )}`;
    return (
      <Stack spacing={2} alignItems="flex-start">
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {t('intro.title')}
        </Typography>
        <Alert severity="info">
          {t('intro.guestBody')}
        </Alert>
        <Button
          variant="contained"
          component={RouterLink}
          to={createAccountUrl}
          sx={{ bgcolor: CLUB_ACCENT, '&:hover': { bgcolor: CLUB_ACCENT_HOVER } }}
        >
          {t('createAccount')}
        </Button>
      </Stack>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      sx={{ maxWidth: 640 }}
    >
      <Typography variant="overline" sx={{ color: CLUB_ACCENT, fontWeight: 700 }}>
        {t('intro.eyebrow')}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
        {t('intro.title')}
      </Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.65)', mt: 1, mb: 3 }}>
        {t('intro.optionalHint', { title: club.title })}
      </Typography>

      {generalError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setGeneralError('')}>
          {generalError}
        </Alert>
      )}

      <Stack spacing={2.5}>
        <TextField
          label={t('intro.country')}
          fullWidth
          placeholder={t('intro.countryPlaceholder')}
          InputLabelProps={{ shrink: true }}
          {...register('country')}
          error={Boolean(errors.country)}
          helperText={errors.country?.message || t('intro.countryHelper')}
          sx={CLUB_TEXT_FIELD_SX}
        />
        <TextField
          label={t('intro.about')}
          fullWidth
          multiline
          minRows={3}
          inputProps={{ maxLength: 1000 }}
          {...register('intro_description')}
          error={Boolean(errors.intro_description)}
          helperText={
            errors.intro_description?.message ||
            t('intro.aboutHelper', { count: descriptionLength })
          }
          sx={CLUB_TEXT_FIELD_SX}
        />
        <TextField
          label={t('intro.profileLink')}
          fullWidth
          placeholder="https://..."
          InputLabelProps={{ shrink: true }}
          {...register('social_url')}
          error={Boolean(errors.social_url)}
          helperText={
            errors.social_url?.message ||
            t('intro.profileHelper')
          }
          sx={CLUB_TEXT_FIELD_SX}
        />
        <TextField
          label={t('intro.otherLink')}
          fullWidth
          placeholder="https://..."
          InputLabelProps={{ shrink: true }}
          {...register('additional_url')}
          error={Boolean(errors.additional_url)}
          helperText={
            errors.additional_url?.message ||
            t('intro.otherHelper')
          }
          sx={CLUB_TEXT_FIELD_SX}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            sx={{ bgcolor: CLUB_ACCENT, '&:hover': { bgcolor: CLUB_ACCENT_HOVER } }}
          >
            {isSubmitting ? t('intro.saving') : t('intro.save')}
          </Button>
          <Button
            component={RouterLink}
            to={`/club-de-lectura/${slug}/comunidad`}
            disabled={isSubmitting}
            sx={{ color: 'rgba(255,255,255,0.7)' }}
          >
            {t('intro.cancel')}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default BookClubIntroduction;
