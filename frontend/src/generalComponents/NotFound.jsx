import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Box, Button, Container, Typography } from '@mui/material';
import '../styles/not-found.css';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <Box className="not-found-page" component="main">
      <div className="not-found-orbit" aria-hidden="true" />
      <div className="not-found-orbit-wide" aria-hidden="true" />
      <Container maxWidth="lg">
        <Box className="not-found-copy">
          <Typography component="p" className="not-found-kicker">
            Academia Blockchain
          </Typography>
          <Typography component="p" className="not-found-code" aria-hidden="true">
            404
          </Typography>
          <Typography component="h1" className="not-found-title">
            No encontramos esta página
          </Typography>
          <Typography component="p" className="not-found-lead">
            El camino que buscas no existe, se movió, o nunca estuvo aquí.
            Vuelve al inicio y sigue explorando con intención.
          </Typography>
          <Box className="not-found-actions">
            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate('/')}
              className="not-found-button not-found-button-primary"
            >
              Volver al inicio
            </Button>
            <Button
              variant="text"
              onClick={() => navigate('/knowledge_path')}
              className="not-found-button not-found-button-secondary"
            >
              Explorar caminos
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default NotFound;
