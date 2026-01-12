import React, { useState } from 'react';
import { Box, Typography, Grid, Button, Alert, Paper } from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import BadgeDisplay from './BadgeDisplay';
import { updateProfile } from '../api/profilesApi';

/**
 * FeaturedBadgeSelector Component
 * Allows users to select a featured badge to display next to their username
 * 
 * @param {Array} badges - Array of user badges
 * @param {number} currentFeaturedBadgeId - ID of currently featured badge
 * @param {Function} onUpdate - Callback when badge is updated
 */
const FeaturedBadgeSelector = ({ badges, currentFeaturedBadgeId, onUpdate }) => {
  const [selectedBadgeId, setSelectedBadgeId] = useState(currentFeaturedBadgeId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      
      // Create form data for the update
      const formData = new FormData();
      // Send empty string to remove badge, or the badge ID as string
      formData.append('featured_badge_id', selectedBadgeId ? selectedBadgeId.toString() : '');
      
      await updateProfile(formData);
      setSuccess(true);
      
      // Call update callback
      if (onUpdate) {
        onUpdate();
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Error al guardar insignia destacada');
      setSuccess(false);
    } finally {
      setSaving(false);
    }
  };

  if (!badges || badges.length === 0) {
    return (
      <Alert severity="info">
        No tienes insignias aún. ¡Sigue participando para obtenerlas!
      </Alert>
    );
  }

  const hasChanges = selectedBadgeId !== currentFeaturedBadgeId;

  return (
    <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Insignia Destacada
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Selecciona una insignia para mostrarla junto a tu nombre de usuario en toda la aplicación.
        Esta insignia aparecerá en el header y en tu perfil público.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
          Insignia destacada actualizada correctamente
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Option: None */}
        <Grid item>
          <Paper
            elevation={selectedBadgeId === null ? 3 : 1}
            onClick={() => setSelectedBadgeId(null)}
            sx={{
              p: 1.5,
              border: selectedBadgeId === null ? 2 : 1,
              borderColor: selectedBadgeId === null ? 'primary.main' : 'divider',
              borderRadius: 2,
              cursor: 'pointer',
              backgroundColor: selectedBadgeId === null ? 'action.selected' : 'background.paper',
              transition: 'all 0.2s ease-in-out',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 80,
              height: 80,
              '&:hover': {
                backgroundColor: 'action.hover',
                transform: 'translateY(-2px)',
                boxShadow: 2,
              },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: 'transparent',
              }}
            >
              <CancelIcon
                sx={{
                  fontSize: 48,
                  color: selectedBadgeId === null ? 'error.main' : 'text.secondary',
                  transition: 'color 0.2s ease-in-out',
                }}
              />
            </Box>
          </Paper>
        </Grid>

        {/* User badges */}
        {badges.map((badge) => (
          <Grid item key={badge.id}>
            <Paper
              elevation={selectedBadgeId === badge.id ? 3 : 1}
              onClick={() => setSelectedBadgeId(badge.id)}
              sx={{
                p: 1.5,
                border: selectedBadgeId === badge.id ? 2 : 1,
                borderColor: selectedBadgeId === badge.id ? 'primary.main' : 'divider',
                borderRadius: 2,
                cursor: 'pointer',
                backgroundColor: selectedBadgeId === badge.id ? 'action.selected' : 'background.paper',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: 'action.hover',
                  transform: 'translateY(-2px)',
                  boxShadow: 2,
                },
              }}
            >
              <BadgeDisplay badge={badge} showName={false} context="badgeList" />
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          sx={{ minWidth: 200 }}
        >
          {saving 
            ? 'Guardando...' 
            : selectedBadgeId === null 
              ? 'Remover Insignia' 
              : 'Elegir Insignia Destacada'}
        </Button>
        {hasChanges && (
          <Typography variant="caption" color="text.secondary">
            Tienes cambios sin guardar
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default FeaturedBadgeSelector;