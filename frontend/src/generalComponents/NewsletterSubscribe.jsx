import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Container, Box, Typography, TextField, Button, Alert, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { submitNewsletterSubscription } from '../api/profilesApi';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';
import { emailField } from '../utils/formSchemas';
import { bindMuiRhfField } from '../utils/muiRhfField';

const schema = yup.object({
  email: emailField(),
});

const NewsletterSubscribe = () => {
  const { t } = useTranslation('public');
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
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { email: '' },
  });
  const emailValue = watch('email');

  const onSubmit = async ({ email }) => {
    setSuccessMessage('');
    setGeneralError('');

    try {
      await submitNewsletterSubscription(email.trim());
      setSuccessMessage(t('newsletter.success'));
      reset({ email: '' });
    } catch (err) {
      const { generalError: parsed } = applyApiErrorsToForm(
        err,
        setError,
        t('newsletter.error'),
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
            {t('newsletter.title')}
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
            {t('newsletter.lead')}
          </Typography>

          <Box
            component="form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              type="email"
              label={t('newsletter.email')}
              {...bindMuiRhfField(register('email'), emailValue)}
              error={!!errors.email}
              helperText={errors.email?.message}
              placeholder={t('newsletter.placeholder')}
              fullWidth
              variant="outlined"
              size="medium"
              autoComplete="email"
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
                {isSubmitting ? t('newsletter.sending') : t('newsletter.submit')}
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
            {t('newsletter.privacy')}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default NewsletterSubscribe;
