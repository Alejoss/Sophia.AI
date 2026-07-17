import React, { useEffect, useState } from 'react';
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
    'Introduce un enlace válido (por ejemplo https://tu-sitio.com).',
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
  intro_description: yup
    .string()
    .trim()
    .required('Cuéntanos qué haces para poder presentarte al club.')
    .max(1000, 'Máximo 1000 caracteres.'),
  social_url: optionalLink,
  additional_url: optionalLink,
});

const BookClubIntroduction = () => {
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
            intro_description: data.intro_description || '',
            social_url: data.social_url || '',
            additional_url: data.additional_url || '',
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setGeneralError(
            err?.response?.data?.detail || 'No se pudo cargar tu presentación.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, isGuest, canParticipate, reset]);

  const onSubmit = async (data) => {
    setGeneralError('');
    try {
      await bookClubsApi.updateMemberIntroduction(slug, {
        intro_description: data.intro_description.trim(),
        social_url: data.social_url.trim(),
        additional_url: data.additional_url.trim(),
      });
      navigate(`/club-de-lectura/${slug}/comunidad`, { replace: true });
    } catch (err) {
      const { generalError: parsed } = applyApiErrorsToForm(
        err,
        setError,
        'No se pudo guardar tu presentación.'
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
          Preséntate al club
        </Typography>
        <Alert severity="info">
          Crea tu cuenta para presentarte y participar en la comunidad.
        </Alert>
        <Button
          variant="contained"
          component={RouterLink}
          to={createAccountUrl}
          sx={{ bgcolor: CLUB_ACCENT, '&:hover': { bgcolor: CLUB_ACCENT_HOVER } }}
        >
          Crear cuenta
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
        Comunidad
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
        Preséntate al club
      </Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.65)', mt: 1, mb: 3 }}>
        Comparte una presentación breve con los miembros de {club.title}. Podrás
        editarla cuando quieras.
      </Typography>

      {generalError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setGeneralError('')}>
          {generalError}
        </Alert>
      )}

      <Stack spacing={2.5}>
        <TextField
          label="¿Qué haces?"
          required
          fullWidth
          multiline
          minRows={4}
          inputProps={{ maxLength: 1000 }}
          {...register('intro_description')}
          error={Boolean(errors.intro_description)}
          helperText={
            errors.intro_description?.message ||
            `${descriptionLength}/1000 · Cuéntanos a qué te dedicas o qué te interesa.`
          }
          sx={CLUB_TEXT_FIELD_SX}
        />
        <TextField
          label="Link a red social"
          fullWidth
          placeholder="https://..."
          InputLabelProps={{ shrink: true }}
          {...register('social_url')}
          error={Boolean(errors.social_url)}
          helperText={errors.social_url?.message || 'Opcional.'}
          sx={CLUB_TEXT_FIELD_SX}
        />
        <TextField
          label="Otro link más"
          fullWidth
          placeholder="https://..."
          InputLabelProps={{ shrink: true }}
          {...register('additional_url')}
          error={Boolean(errors.additional_url)}
          helperText={errors.additional_url?.message || 'Opcional: web, proyecto, newsletter…'}
          sx={CLUB_TEXT_FIELD_SX}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            sx={{ bgcolor: CLUB_ACCENT, '&:hover': { bgcolor: CLUB_ACCENT_HOVER } }}
          >
            {isSubmitting ? 'Guardando…' : 'Guardar presentación'}
          </Button>
          <Button
            component={RouterLink}
            to={`/club-de-lectura/${slug}/comunidad`}
            disabled={isSubmitting}
            sx={{ color: 'rgba(255,255,255,0.7)' }}
          >
            Cancelar
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default BookClubIntroduction;
