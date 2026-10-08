import { useContext, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import bookClubsApi from '../api/bookClubsApi';
import { completeFromInvite } from '../api/profilesApi';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';
import { passwordField, usernameField } from '../utils/formSchemas';
import { bindMuiRhfField } from '../utils/muiRhfField.js';
import { clearGuestSession } from '../bookClubs/guestStorage';

const CompletarCuenta = () => {
  const { t } = useTranslation('auth');
  const schema = useMemo(
    () =>
      yup.object({
        username: usernameField(),
        password: passwordField(),
        confirmPassword: yup
          .string()
          .required(() => t('completar.confirmRequired'))
          .oneOf([yup.ref('password')], () => t('completar.mismatch')),
      }),
    [t],
  );
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateAuthState } = useContext(AuthContext);
  const token = searchParams.get('token') || '';
  const next = searchParams.get('next') || '';

  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    mode: 'onBlur',
    defaultValues: { username: '', password: '', confirmPassword: '' },
  });

  const usernameValue = watch('username');
  const passwordValue = watch('password');
  const confirmPasswordValue = watch('confirmPassword');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setPreviewError(t('completar.missingInvite'));
        setLoadingPreview(false);
        return;
      }
      try {
        const data = await bookClubsApi.getInvitePreview(token);
        if (!cancelled) setPreview(data);
      } catch (err) {
        if (!cancelled) {
          setPreviewError(
            err?.response?.data?.detail || t('completar.invalidLink')
          );
        }
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const onSubmit = async ({ username, password }) => {
    setServerError('');
    try {
      const data = await completeFromInvite({ token, username, password });
      if (data?.access_token) {
        const { access_token, club_slug, ...userData } = data;
        updateAuthState(userData, access_token);
        if (club_slug) clearGuestSession(club_slug);
        const dest = next || (club_slug ? `/club-de-lectura/${club_slug}` : '/');
        navigate(dest, { replace: true });
        return;
      }
      setServerError(t('completar.createdNoSession'));
    } catch (error) {
      if (error?.response?.data?.code === 'email_exists') {
        const hint = error.response.data.next_hint || next || '/club-de-lectura';
        setServerError(error.response.data.detail);
        return;
      }
      const { generalError } = applyApiErrorsToForm(
        error,
        setError,
        t('completar.completeError')
      );
      if (generalError) setServerError(generalError);
    }
  };

  if (loadingPreview) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (previewError) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {previewError}
        </Alert>
        <Button component={RouterLink} to={next || '/club-de-lectura'}>
          {t('completar.backToClub')}
        </Button>
      </Container>
    );
  }

  const loginNext = next || (preview?.slug ? `/club-de-lectura/${preview.slug}` : '/');

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: { xs: 3, md: 4 } }}>
        <Typography variant="h4" gutterBottom fontWeight={700}>
          {t('completar.title')}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          <Trans
            t={t}
            i18nKey="completar.lead"
            values={{ club: preview?.club_title || t('completar.fallbackClub') }}
            components={{ strong: <strong /> }}
          />
        </Typography>

        {serverError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setServerError('')}>
            {serverError}
            {serverError.includes('Inicia sesión') && (
              <Box sx={{ mt: 1 }}>
                <Button
                  size="small"
                  component={RouterLink}
                  to={`/profiles/login?next=${encodeURIComponent(loginNext)}`}
                >
                  {t('completar.goToLogin')}
                </Button>
              </Box>
            )}
          </Alert>
        )}

        <Stack
          component="form"
          spacing={2}
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <TextField
            label={t('completar.email')}
            value={preview?.email || ''}
            fullWidth
            InputProps={{ readOnly: true }}
            InputLabelProps={{ shrink: Boolean(preview?.email) || undefined }}
          />
          <TextField
            label={t('completar.username')}
            fullWidth
            {...bindMuiRhfField(register('username'), usernameValue)}
            error={Boolean(errors.username)}
            helperText={errors.username?.message}
          />
          <TextField
            label={t('completar.password')}
            type="password"
            fullWidth
            {...bindMuiRhfField(register('password'), passwordValue)}
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
          />
          <TextField
            label={t('completar.confirmPassword')}
            type="password"
            fullWidth
            {...bindMuiRhfField(register('confirmPassword'), confirmPasswordValue)}
            error={Boolean(errors.confirmPassword)}
            helperText={errors.confirmPassword?.message}
          />
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? t('completar.submitting') : t('completar.submit')}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default CompletarCuenta;
