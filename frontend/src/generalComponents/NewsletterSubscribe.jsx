import React, { useState } from 'react';
import { Container, Box, Typography, TextField, Button, Alert, useTheme } from '@mui/material';
import { submitNewsletterSubscription } from '../api/profilesApi';

const NewsletterSubscribe = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Por favor, introduce un email válido.');
      return;
    }

    setLoading(true);
    try {
      await submitNewsletterSubscription(trimmedEmail);
      setSuccessMessage('¡Gracias por suscribirte! Te avisaremos de las próximas novedades.');
      setEmail('');
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.email?.[0] ||
        'No se ha podido completar la suscripción. Inténtalo de nuevo más tarde.';
      setErrorMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: { xs: 4, md: 6 },
      }}
    >
      <Container maxWidth="sm">
        <Box
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            boxShadow: 2,
            px: { xs: 3, md: 4 },
            py: { xs: 3, md: 4 },
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
            Suscríbete a la newsletter
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
            Déjanos tu email y te avisaremos cuando lancemos nuevos contenidos, formaciones y
            novedades de Academia Blockchain.
          </Typography>

          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email"
              fullWidth
              variant="outlined"
              size="medium"
            />

            {errorMessage && (
              <Alert severity="error" variant={isDark ? 'filled' : 'outlined'}>
                {errorMessage}
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
                disabled={loading}
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
                {loading ? 'Enviando...' : 'Quiero suscribirme'}
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


