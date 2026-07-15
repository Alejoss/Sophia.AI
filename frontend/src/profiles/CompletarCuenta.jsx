import { useContext, useEffect, useState } from 'react';
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
import { clearGuestSession } from '../bookClubs/guestStorage';

const schema = yup.object({
  username: usernameField(),
  password: passwordField(),
  confirmPassword: yup
    .string()
    .required('Confirma tu contraseña.')
    .oneOf([yup.ref('password')], 'Las contraseñas no coinciden.'),
});

const CompletarCuenta = () => {
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
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    mode: 'onBlur',
    defaultValues: { username: '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setPreviewError('Falta el enlace de invitación. Vuelve al club e introduce tu correo.');
        setLoadingPreview(false);
        return;
      }
      try {
        const data = await bookClubsApi.getInvitePreview(token);
        if (!cancelled) setPreview(data);
      } catch (err) {
        if (!cancelled) {
          setPreviewError(
            err?.response?.data?.detail || 'Este enlace no es válido o ha caducado.'
          );
        }
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
      setServerError(
        'Cuenta creada, pero no se pudo iniciar sesión automáticamente. Prueba iniciar sesión.'
      );
    } catch (error) {
      if (error?.response?.data?.code === 'email_exists') {
        const hint = error.response.data.next_hint || next || '/club-de-lectura';
        setServerError(error.response.data.detail);
        return;
      }
      const { generalError } = applyApiErrorsToForm(
        error,
        setError,
        'No se pudo completar el registro.'
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
          Volver al club
        </Button>
      </Container>
    );
  }

  const loginNext = next || (preview?.slug ? `/club-de-lectura/${preview.slug}` : '/');

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: { xs: 3, md: 4 } }}>
        <Typography variant="h4" gutterBottom fontWeight={700}>
          Crea tu cuenta
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Completa tu perfil para participar en{' '}
          <strong>{preview?.club_title || 'el Club de Lectura'}</strong>. Tu correo ya está
          confirmado.
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
                  Ir a iniciar sesión
                </Button>
              </Box>
            )}
          </Alert>
        )}

        <Stack
          component="form"
          spacing={2}
          onSubmit={handleSubmit(onSubmit)}
        >
          <TextField
            label="Correo"
            value={preview?.email || ''}
            fullWidth
            InputProps={{ readOnly: true }}
          />
          <TextField
            label="Nombre de usuario"
            fullWidth
            {...register('username')}
            error={Boolean(errors.username)}
            helperText={errors.username?.message}
          />
          <TextField
            label="Contraseña"
            type="password"
            fullWidth
            {...register('password')}
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
          />
          <TextField
            label="Confirmar contraseña"
            type="password"
            fullWidth
            {...register('confirmPassword')}
            error={Boolean(errors.confirmPassword)}
            helperText={errors.confirmPassword?.message}
          />
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta y volver al club'}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default CompletarCuenta;
