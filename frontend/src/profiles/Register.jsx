import { useState, useContext, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { AuthContext } from '../context/AuthContext.jsx';
import { apiRegister } from '../api/profilesApi';
import SocialLogin from '../components/SocialLogin';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';
import {
  emailField,
  getPasswordRuleErrors,
  passwordField,
  usernameField,
} from '../utils/formSchemas';
import { getAuthNextPath } from '../utils/authNext';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

const registerSchema = yup.object({
  username: usernameField(),
  email: emailField('correo electrónico'),
  password: passwordField(),
  confirmPassword: yup
    .string()
    .required('Por favor, confirma tu contraseña.')
    .oneOf(
      [yup.ref('password')],
      'Las contraseñas no coinciden. Por favor, verifica que ambas contraseñas sean iguales.',
    ),
});

/**
 * Registration — auth contract (docs/api/authentication.md):
 * POST /api/profiles/register/ with { username, email, password } only.
 * On 201: store access_token via updateAuthState; refresh cookie is set by backend.
 * Never send confirmPassword; never log tokens.
 */
const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const authNext = getAuthNextPath(searchParams, location.state);
  const { updateAuthState } = useContext(AuthContext);
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const fieldRefs = useRef({});

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting, touchedFields },
  } = useForm({
    resolver: yupResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = watch('password');
  const passwordOk =
    Boolean(passwordValue) &&
    touchedFields.password &&
    !errors.password &&
    getPasswordRuleErrors(passwordValue).length === 0;

  const usernameRegister = register('username');
  const emailRegister = register('email');
  const passwordRegister = register('password');
  const confirmRegister = register('confirmPassword');

  const bindField = (fieldRegister, name) => {
    const { ref, ...rest } = fieldRegister;
    return {
      ...rest,
      inputRef: (el) => {
        ref(el);
        fieldRefs.current[name] = el;
      },
    };
  };

  const scrollToFirstError = (fieldErrors) => {
    const firstKey = Object.keys(fieldErrors)[0];
    const el = fieldRefs.current[firstKey];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus?.();
    }
  };

  const onInvalid = (fieldErrors) => {
    scrollToFirstError(fieldErrors);
  };

  const onSubmit = async ({ username, email, password }) => {
    setServerError('');

    try {
      // Auth contract: body must NOT include confirmPassword
      const response = await apiRegister({ username, email, password });

      if (response.data?.access_token) {
        const { access_token, ...userData } = response.data;
        updateAuthState(userData, access_token);
        navigate(authNext || '/profiles/login_successful');
        return;
      }

      // User created but token missing (backend edge case) — stay on page with guidance
      if (response.data) {
        setServerError(
          'Tu cuenta se creó, pero no se pudo iniciar sesión automáticamente. Prueba iniciar sesión manualmente.',
        );
      }
    } catch (error) {
      console.error('Registration error:', error);

      if (error.request && !error.response) {
        setServerError(
          'No se pudo conectar con el servidor. Por favor, verifica tu conexión a internet e intenta nuevamente.',
        );
        return;
      }

      const { generalError } = applyApiErrorsToForm(
        error,
        setError,
        'Ocurrió un error inesperado durante el registro. Por favor, intenta nuevamente.',
      );
      if (generalError) {
        setServerError(generalError);
      }
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 2, md: 4 } }}>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          Crear cuenta
        </Typography>

        {serverError && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {serverError}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
          <Stack spacing={2}>
            <TextField
              id="username"
              label="Nombre de usuario"
              {...bindField(usernameRegister, 'username')}
              onKeyDown={(e) => {
                if (e.key === '@') {
                  e.preventDefault();
                }
              }}
              error={Boolean(errors.username)}
              helperText={errors.username?.message || ''}
              fullWidth
              autoComplete="username"
            />

            <TextField
              id="email"
              label="Correo electrónico"
              type="email"
              {...bindField(emailRegister, 'email')}
              error={Boolean(errors.email)}
              helperText={errors.email?.message || ''}
              fullWidth
              autoComplete="email"
            />

            <TextField
              id="password"
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              {...bindField(passwordRegister, 'password')}
              error={Boolean(errors.password)}
              helperText={
                errors.password?.message ? (
                  <Box component="span" sx={{ whiteSpace: 'pre-line' }}>
                    {errors.password.message}
                  </Box>
                ) : (
                  ''
                )
              }
              fullWidth
              autoComplete="new-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? (
                        <VisibilityOffIcon fontSize="small" />
                      ) : (
                        <VisibilityIcon fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {passwordOk && (
              <Alert severity="success">
                La contraseña cumple con todos los requisitos de seguridad.
              </Alert>
            )}

            <TextField
              id="confirmPassword"
              label="Confirmar contraseña"
              type={showConfirmPassword ? 'text' : 'password'}
              {...bindField(confirmRegister, 'confirmPassword')}
              error={Boolean(errors.confirmPassword)}
              helperText={errors.confirmPassword?.message || ''}
              fullWidth
              autoComplete="new-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={
                        showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                      }
                    >
                      {showConfirmPassword ? (
                        <VisibilityOffIcon fontSize="small" />
                      ) : (
                        <VisibilityIcon fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
              {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </Stack>
        </Box>

        <Divider sx={{ my: 3 }}>O continúa con</Divider>
        <SocialLogin />
      </Paper>
    </Container>
  );
};

export default Register;
