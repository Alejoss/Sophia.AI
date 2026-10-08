import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  Alert,
  Box,
  Button,
  Container,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { confirmPasswordReset } from "../api/profilesApi.js";
import { applyApiErrorsToForm } from "../utils/apiFormErrors.js";
import { passwordField } from "../utils/formSchemas.js";
import { bindMuiRhfField } from "../utils/muiRhfField.js";

const PasswordResetConfirm = () => {
  const { t } = useTranslation('auth');
  const schema = useMemo(
    () =>
      yup.object({
        newPassword: passwordField(),
        confirmPassword: yup
          .string()
          .required(() => t('reset.confirmRequired'))
          .oneOf([yup.ref('newPassword')], () => t('reset.mismatch')),
      }),
    [t],
  );
  const { uid, token } = useParams();
  const [generalError, setGeneralError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const linkInvalid = !uid || !token;

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const newPasswordValue = watch("newPassword");
  const confirmPasswordValue = watch("confirmPassword");

  const onSubmit = async ({ newPassword, confirmPassword }) => {
    setGeneralError("");
    try {
      await confirmPasswordReset({
        uid,
        token,
        newPassword1: newPassword,
        newPassword2: confirmPassword,
      });
      setSuccess(true);
    } catch (error) {
      const { generalError: parsed } = applyApiErrorsToForm(
        error,
        setError,
        t('reset.error'),
        {
          new_password1: "newPassword",
          new_password2: "confirmPassword",
          token: "newPassword",
          uid: "newPassword",
        },
      );
      if (parsed) setGeneralError(parsed);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, md: 6 } }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, textAlign: "center" }}>
          {t('reset.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: "center" }}>
          {t('reset.lead')}
        </Typography>

        {linkInvalid ? (
          <Stack spacing={2}>
            <Alert severity="error">
              {t('reset.invalidLink')}
            </Alert>
            <Typography variant="body2" sx={{ textAlign: "center" }}>
              <MuiLink component={Link} to="/profiles/forgot-password" underline="hover">
                {t('reset.requestNew')}
              </MuiLink>
            </Typography>
          </Stack>
        ) : success ? (
          <Stack spacing={2}>
            <Alert severity="success">
              {t('reset.success')}
            </Alert>
            <Button component={Link} to="/profiles/login" variant="contained" size="large">
              {t('reset.goToLogin')}
            </Button>
          </Stack>
        ) : (
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              {generalError && <Alert severity="error">{generalError}</Alert>}

              <TextField
                label={t('reset.newPassword')}
                type={showPassword ? "text" : "password"}
                {...bindMuiRhfField(register("newPassword"), newPasswordValue)}
                error={!!errors.newPassword}
                helperText={
                  errors.newPassword?.message || t('reset.helper')
                }
                fullWidth
                autoComplete="new-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        onClick={() => setShowPassword((v) => !v)}
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

              <TextField
                label={t('reset.confirmPassword')}
                type={showConfirm ? "text" : "password"}
                {...bindMuiRhfField(register("confirmPassword"), confirmPasswordValue)}
                error={!!errors.confirmPassword}
                helperText={errors.confirmPassword?.message}
                fullWidth
                autoComplete="new-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        onClick={() => setShowConfirm((v) => !v)}
                        aria-label={
                          showConfirm ? t('hidePassword') : t('showPassword')
                        }
                      >
                        {showConfirm ? (
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
                {isSubmitting ? t('reset.submitting') : t('reset.submit')}
              </Button>

              <Typography variant="body2" sx={{ textAlign: "center" }}>
                <MuiLink component={Link} to="/profiles/login" underline="hover">
                  {t('reset.backToLogin')}
                </MuiLink>
              </Typography>
            </Stack>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default PasswordResetConfirm;
