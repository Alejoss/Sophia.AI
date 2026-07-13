import React, { useContext, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import { submitNewsletterSubscription } from '../api/profilesApi';
import bookClubsApi from '../api/bookClubsApi';

const ClubDeLectura = () => {
  const { authState, authInitialized } = useContext(AuthContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeClub, setActiveClub] = useState(null);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!authInitialized || !authState.isAuthenticated) {
      setActiveClub(null);
      return;
    }
    let cancelled = false;
    setClubsLoading(true);
    bookClubsApi
      .listClubs()
      .then((clubs) => {
        if (cancelled) return;
        const preferred =
          clubs.find((c) => c.status === 'active') ||
          clubs.find((c) => c.is_member) ||
          clubs[0] ||
          null;
        setActiveClub(preferred);
      })
      .catch(() => {
        if (!cancelled) setActiveClub(null);
      })
      .finally(() => {
        if (!cancelled) setClubsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authInitialized, authState.isAuthenticated]);

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

  const handleEnterClub = async () => {
    if (!activeClub) return;
    setJoining(true);
    setErrorMessage('');
    try {
      if (!activeClub.is_member) {
        await bookClubsApi.joinClub(activeClub.slug);
      }
      navigate(`/club-de-lectura/${activeClub.slug}`);
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'No se pudo entrar al club.');
    } finally {
      setJoining(false);
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

      {authState.isAuthenticated && (
        <Box sx={{ width: '100%', maxWidth: 480, mb: 3, textAlign: 'center' }}>
          {clubsLoading ? (
            <CircularProgress size={28} sx={{ color: '#FF6B35' }} />
          ) : activeClub ? (
            <>
              <Typography sx={{ color: '#fff', mb: 1.5 }}>
                {activeClub.is_member
                  ? `Ya formas parte de «${activeClub.title}».`
                  : `El club «${activeClub.title}» ya está activo.`}
              </Typography>
              <Button
                variant="contained"
                onClick={handleEnterClub}
                disabled={joining}
                sx={{
                  bgcolor: '#FF6B35',
                  '&:hover': { bgcolor: '#E55A2B' },
                  textTransform: 'none',
                  fontWeight: 600,
                  py: 1.2,
                  mb: 1,
                }}
                fullWidth
              >
                {joining
                  ? 'Entrando…'
                  : activeClub.is_member
                    ? 'Ir al hub del club'
                    : 'Unirme y entrar al hub'}
              </Button>
            </>
          ) : (
            <Typography sx={{ color: 'rgba(255,255,255,0.65)', mb: 1 }}>
              Aún no hay un ciclo activo. Deja tu email y te avisamos.
            </Typography>
          )}
        </Box>
      )}

      {!authState.isAuthenticated && (
        <Button
          component={RouterLink}
          to="/profiles/login"
          sx={{ color: '#FF6B35', mb: 2, textTransform: 'none' }}
        >
          ¿Ya tienes cuenta? Inicia sesión para entrar al hub
        </Button>
      )}

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
