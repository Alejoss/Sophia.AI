import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  Alert,
  Box,
  Button,
  Container,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { requestPasswordReset } from "../api/profilesApi.js";
import { applyApiErrorsToForm } from "../utils/apiFormErrors.js";
import { emailField } from "../utils/formSchemas.js";
import { bindMuiRhfField } from "../utils/muiRhfField.js";

const schema = yup.object({
  email: emailField(),
});

const ForgotPassword = () => {
  const [generalError, setGeneralError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { email: "" },
  });

  const emailValue = watch("email");

  const onSubmit = async ({ email }) => {
    setGeneralError("");
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (error) {
      const { generalError: parsed } = applyApiErrorsToForm(
        error,
        setError,
        "No se pudo enviar el correo. Inténtalo de nuevo.",
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
          ¿Olvidaste tu contraseña?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: "center" }}>
          Introduce el correo de tu cuenta y te enviaremos un enlace para restablecerla.
        </Typography>

        {submitted ? (
          <Stack spacing={2}>
            <Alert severity="success">
              Si existe una cuenta con el correo{" "}
              <strong>{getValues("email")}</strong>, recibirás un enlace para
              restablecer tu contraseña. Revisa también la carpeta de spam.
            </Alert>
            <Typography variant="body2" sx={{ textAlign: "center" }}>
              <MuiLink component={Link} to="/profiles/login" underline="hover">
                Volver a iniciar sesión
              </MuiLink>
            </Typography>
          </Stack>
        ) : (
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              {generalError && <Alert severity="error">{generalError}</Alert>}

              <TextField
                label="Correo electrónico"
                type="email"
                {...bindMuiRhfField(register("email"), emailValue)}
                error={!!errors.email}
                helperText={errors.email?.message}
                fullWidth
                autoComplete="email"
                autoFocus
              />

              <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                {isSubmitting ? "Enviando..." : "Enviar enlace"}
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

export default ForgotPassword;
