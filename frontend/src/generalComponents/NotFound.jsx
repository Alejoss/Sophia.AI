import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Box, Button, Container, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import '../styles/not-found.css';

const NotFound = () => {
  const { t } = useTranslation('public');
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
            {t('notFound.title')}
          </Typography>
          <Typography component="p" className="not-found-lead">
            {t('notFound.lead')}
          </Typography>
          <Box className="not-found-actions">
            <Button
              component={RouterLink}
              to="/"
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              className="not-found-button not-found-button-primary"
            >
              {t('notFound.home')}
            </Button>
            <Button
              component={RouterLink}
              to="/knowledge_path"
              variant="text"
              className="not-found-button not-found-button-secondary"
            >
              {t('notFound.paths')}
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default NotFound;
