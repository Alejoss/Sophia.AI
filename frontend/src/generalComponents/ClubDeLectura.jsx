import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Box, Typography, TextField, Button, Alert } from '@mui/material';
import { submitNewsletterSubscription } from '../api/profilesApi';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';
import { emailField } from '../utils/formSchemas';

const schema = yup.object({
  email: emailField(),
});

const ClubDeLectura = () => {
  const [successMessage, setSuccessMessage] = useState('');
  const [generalError, setGeneralError] = useState('');

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
      await submitNewsletterSubscription(email.trim(), 'club_de_lectura');
      setSuccessMessage('¡Gracias! Te avisaremos sobre el Club de Lectura.');
      reset({ email: '' });
    } catch (err) {
      const { generalError: parsed } = applyApiErrorsToForm(
        err,
        setError,
        'No se ha podido registrar tu email. Inténtalo de nuevo más tarde.',
      );
      if (parsed) {
        setGeneralError(parsed);
      }
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
        onSubmit={handleSubmit(onSubmit)}
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
          {...register('email')}
          error={!!errors.email}
          helperText={errors.email?.message}
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
            '& .MuiFormHelperText-root': { color: 'error.light' },
          }}
        />

        {generalError && (
          <Alert severity="error" variant="filled">
            {generalError}
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
          disabled={isSubmitting}
          sx={{
            bgcolor: '#FF6B35',
            '&:hover': { bgcolor: '#E55A2B' },
            textTransform: 'none',
            fontWeight: 600,
            py: 1.2,
          }}
          fullWidth
        >
          {isSubmitting ? 'Enviando...' : 'Quiero participar'}
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
