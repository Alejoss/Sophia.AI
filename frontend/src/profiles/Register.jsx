import { useState, useContext, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { bindMuiRhfField } from '../utils/muiRhfField.js';
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

/**
 * Registration — auth contract (docs/api/authentication.md):
 * POST /api/profiles/register/ with { username, email, password } only.
 * On 201: store access_token via updateAuthState; refresh cookie is set by backend.
 * Never send confirmPassword; never log tokens.
 */
const Register = () => {
  const { t } = useTranslation('auth');
  const registerSchema = useMemo(
    () =>
      yup.object({
        username: usernameField(),
        email: emailField(),
        password: passwordField(),
        confirmPassword: yup
          .string()
          .required(() => t('register.confirmRequired'))
          .oneOf([yup.ref('password')], () => t('register.passwordMismatch')),
      }),
    [t],
  );
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

  const usernameValue = watch('username');
  const emailValue = watch('email');
  const passwordValue = watch('password');
  const confirmPasswordValue = watch('confirmPassword');
  const passwordOk =
    Boolean(passwordValue) &&
    touchedFields.password &&
    !errors.password &&
    getPasswordRuleErrors(passwordValue).length === 0;

  const bindField = (name, value) =>
    bindMuiRhfField(register(name), value, {
      onInputRef: (el) => {
        fieldRefs.current[name] = el;
      },
    });

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
        setServerError(t('register.createdNoSession'));
      }
    } catch (error) {
      console.error('Registration error:', error);

      if (error.request && !error.response) {
        setServerError(t('register.networkError'));
        return;
      }

      const { generalError } = applyApiErrorsToForm(
        error,
        setError,
        t('register.unexpected'),
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
          {t('register.title')}
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
              label={t('register.username')}
              {...bindField('username', usernameValue)}
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
              label={t('register.email')}
              type="email"
              {...bindField('email', emailValue)}
              error={Boolean(errors.email)}
              helperText={errors.email?.message || ''}
              fullWidth
              autoComplete="email"
            />

            <TextField
              id="password"
              label={t('register.password')}
              type={showPassword ? 'text' : 'password'}
              {...bindField('password', passwordValue)}
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
                      aria-label={showPassword ? t('hidePassword') : t('showPassword')}
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
                {t('register.passwordMeetsRules')}
              </Alert>
            )}

            <TextField
              id="confirmPassword"
              label={t('register.confirmPassword')}
              type={showConfirmPassword ? 'text' : 'password'}
              {...bindField('confirmPassword', confirmPasswordValue)}
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
                        showConfirmPassword ? t('hidePassword') : t('showPassword')
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
              {isSubmitting ? t('register.submitting') : t('register.submit')}
            </Button>
          </Stack>
        </Box>

        <Divider sx={{ my: 3 }}>{t('register.orContinue')}</Divider>
        <SocialLogin />
      </Paper>
    </Container>
  );
};

export default Register;
