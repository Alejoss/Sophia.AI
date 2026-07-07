import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Alert } from '@mui/material';
import { submitNewsletterSubscription } from '../api/profilesApi';

const ClubDeLectura = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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
      await submitNewsletterSubscription(trimmedEmail, 'club_de_lectura');
      setSuccessMessage('¡Gracias! Te avisaremos sobre el Club de Lectura.');
      setEmail('');
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.email?.[0] ||
        'No se ha podido registrar tu email. Inténtalo de nuevo más tarde.';
      setErrorMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#0d0d0d',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: { xs: 2, md: 4 },
        px: { xs: 2, md: 4 },
      }}
    >
      <Box
        component="img"
        src="/images/club-de-lectura.png"
        alt="Club de Lectura — Seminario Cypherpunk. El secuestro de Bitcoin de Roger Ver y Steve Patterson."
        sx={{
          width: '100%',
          maxWidth: 1200,
          height: 'auto',
          borderRadius: 1,
          mb: 3,
        }}
      />

      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Typography
          variant="h6"
          component="h2"
          sx={{ color: '#FF6B35', fontWeight: 600, textAlign: 'center' }}
        >
          Apúntate al Club de Lectura
        </Typography>

        <TextField
          type="email"
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          fullWidth
          variant="outlined"
          size="medium"
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.06)',
              color: '#fff',
            },
            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,107,53,0.5)' },
          }}
        />

        {errorMessage && (
          <Alert severity="error" variant="filled">
            {errorMessage}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" variant="filled">
            {successMessage}
          </Alert>
        )}

        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          sx={{
            bgcolor: '#FF6B35',
            '&:hover': { bgcolor: '#E55A2B' },
            textTransform: 'none',
            fontWeight: 600,
            py: 1.2,
          }}
          fullWidth
        >
          {loading ? 'Enviando...' : 'Quiero participar'}
        </Button>

        <Typography
          variant="caption"
          sx={{ color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 1.5 }}
        >
          Solo usaremos tu correo para informarte sobre el Club de Lectura.
        </Typography>
      </Box>
    </Box>
  );
};

export default ClubDeLectura;
