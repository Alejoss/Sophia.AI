import { useState } from "react";
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

const schema = yup.object({
  newPassword: passwordField(),
  confirmPassword: yup
    .string()
    .required("Confirma la nueva contraseña.")
    .oneOf([yup.ref("newPassword")], "Las contraseñas no coinciden."),
});

const PasswordResetConfirm = () => {
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
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

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
        "No se pudo restablecer la contraseña. El enlace puede haber caducado.",
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
          Nueva contraseña
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: "center" }}>
          Elige una contraseña segura para tu cuenta.
        </Typography>

        {linkInvalid ? (
          <Stack spacing={2}>
            <Alert severity="error">
              Este enlace no es válido. Solicita uno nuevo desde la página de recuperación.
            </Alert>
            <Typography variant="body2" sx={{ textAlign: "center" }}>
              <MuiLink component={Link} to="/profiles/forgot-password" underline="hover">
                Solicitar nuevo enlace
              </MuiLink>
            </Typography>
          </Stack>
        ) : success ? (
          <Stack spacing={2}>
            <Alert severity="success">
              Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.
            </Alert>
            <Button component={Link} to="/profiles/login" variant="contained" size="large">
              Ir a iniciar sesión
            </Button>
          </Stack>
        ) : (
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              {generalError && <Alert severity="error">{generalError}</Alert>}

              <TextField
                label="Nueva contraseña"
                type={showPassword ? "text" : "password"}
                {...register("newPassword")}
                error={!!errors.newPassword}
                helperText={
                  errors.newPassword?.message ||
                  "Mínimo 8 caracteres, mayúsculas, minúsculas, números y símbolos"
                }
                fullWidth
                autoComplete="new-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
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
                label="Confirmar nueva contraseña"
                type={showConfirm ? "text" : "password"}
                {...register("confirmPassword")}
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
                          showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"
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
                {isSubmitting ? "Guardando..." : "Restablecer contraseña"}
              </Button>

              <Typography variant="body2" sx={{ textAlign: "center" }}>
                <MuiLink component={Link} to="/profiles/login" underline="hover">
                  Volver a iniciar sesión
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
