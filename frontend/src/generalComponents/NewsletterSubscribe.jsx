import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Container, Box, Typography, TextField, Button, Alert, useTheme } from '@mui/material';
import { submitNewsletterSubscription } from '../api/profilesApi';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';
import { emailField } from '../utils/formSchemas';

const schema = yup.object({
  email: emailField(),
});

const NewsletterSubscribe = () => {
  const [successMessage, setSuccessMessage] = useState('');
  const [generalError, setGeneralError] = useState('');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const heroBoxBg = isDark ? 'rgba(30,30,30,0.9)' : 'rgba(255,255,255,0.77)';

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async ({ email }) => {
    setSuccessMessage('');
    setGeneralError('');

    try {
      await submitNewsletterSubscription(email.trim());
      setSuccessMessage('¡Gracias por suscribirte! Te avisaremos de las próximas novedades.');
      reset({ email: '' });
    } catch (err) {
      const { generalError: parsed } = applyApiErrorsToForm(
        err,
        setError,
        'No se ha podido completar la suscripción. Inténtalo de nuevo más tarde.',
      );
      if (parsed) {
        setGeneralError(parsed);
      }
    }
  };

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        backgroundImage: "url('/images/unirme_background.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: { xs: 4, md: 6 },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.35)',
          zIndex: 1,
        }}
      />
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2 }}>
        <Box
          sx={{
            mx: 'auto',
            maxWidth: 720,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: heroBoxBg,
            boxShadow: 2,
            px: { xs: 2, md: 4 },
            py: { xs: 2.5, md: 3 },
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 600,
              mb: 1.5,
              color: 'text.primary',
              fontSize: { xs: '1.7rem', md: '2rem' },
            }}
          >
            Únete a la comunidad
          </Typography>

          <Typography
            variant="body1"
            sx={{
              mb: 3,
              color: 'text.secondary',
              fontSize: { xs: '0.95rem', md: '1rem' },
              lineHeight: 1.6,
            }}
          >
            Déjanos tu email y te mantendremos al tanto del avance del proyecto, las novedades de
            Academia Blockchain y documentales clave. También podrás sumarte a investigaciones de
            código abierto, conectar con una comunidad de estudio y compartir, junto a nosotros, la
            construcción de esta plataforma revolucionaria.
          </Typography>

          <Box
            component="form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              type="email"
              label="Email"
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message}
              placeholder="tu@email"
              fullWidth
              variant="outlined"
              size="medium"
            />

            {generalError && (
              <Alert severity="error" variant={isDark ? 'filled' : 'outlined'}>
                {generalError}
              </Alert>
            )}
            {successMessage && (
              <Alert severity="success" variant={isDark ? 'filled' : 'outlined'}>
                {successMessage}
              </Alert>
            )}

            <Box sx={{ mt: 1 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting}
                sx={{
                  bgcolor: '#FF6B35',
                  '&:hover': {
                    bgcolor: '#E55A2B',
                  },
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  py: 1.2,
                }}
                fullWidth
              >
                {isSubmitting ? 'Enviando...' : 'Quiero suscribirme'}
              </Button>
            </Box>
          </Box>

          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 2,
              color: 'text.secondary',
              lineHeight: 1.5,
            }}
          >
            Solo usaremos tu correo para enviarte información relevante sobre Academia Blockchain.
            Puedes darte de baja en cualquier momento.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default NewsletterSubscribe;
