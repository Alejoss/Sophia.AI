import React, { useState, useEffect } from 'react';
import { Snackbar, Alert, Box, Typography } from '@mui/material';
import BadgeDisplay from './BadgeDisplay';

const BadgeNotification = ({ badge, open, onClose }) => {
  const [isVisible, setIsVisible] = useState(open);

  useEffect(() => {
    setIsVisible(open);
  }, [open]);

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  };

  if (!badge) {
    return null;
  }

  return (
    <Snackbar
      open={isVisible}
      autoHideDuration={6000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ mt: 8 }}
    >
      <Alert
        onClose={handleClose}
        severity="success"
        sx={{
          width: '100%',
          minWidth: 300,
          '& .MuiAlert-message': {
            width: '100%',
          },
        }}
        icon={false}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <BadgeDisplay badge={badge} showName={false} context="notification" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              ¡Nueva Insignia Desbloqueada!
            </Typography>
            <Typography variant="body2">
              {badge.badge_name || badge.name}
            </Typography>
            {badge.points_earned !== undefined && (
              <Typography variant="caption" color="text.secondary">
                +{badge.points_earned} puntos
              </Typography>
            )}
          </Box>
        </Box>
      </Alert>
    </Snackbar>
  );
};

export default BadgeNotification;