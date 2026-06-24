import React from 'react';
import { Link } from 'react-router-dom';
import ApiIcon from '@mui/icons-material/Api';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Tooltip, Typography, Box, Container, Button, CircularProgress, Alert, Paper, Stack, IconButton, Link as MuiLink } from '@mui/material';

const Notifications = ({
  notifications = [],
  loading = false,
  error = null,
  unreadCount = 0,
  onMarkAsRead = () => {},
  onMarkAllAsRead = () => {},
  onRefresh = () => {}
}) => {


  const getNotificationDescription = (notification) => {
    if (notification.verb === 'comentó en tu camino de conocimiento') {
      return `${notification.actor} comentó en tu camino de conocimiento ${notification.context_title}`;
    } else if (notification.verb === 'respondió a') {
      return `${notification.actor} respondió a tu comentario en ${notification.context_title}`;
    } else if (notification.verb === 'completó tu camino de conocimiento') {
      return notification.description;
    } else if (notification.verb === 'solicitó un certificado para tu camino de conocimiento') {
      return notification.description;
    } else if (notification.verb === 'aprobó tu solicitud de certificado para') {
      return notification.description;
    } else if (notification.verb === 'rechazó tu solicitud de certificado para') {
      return notification.description;
    } else if (notification.verb === 'votó a favor de tu contenido') {
      return notification.description;
    } else if (notification.verb === 'votó a favor de tu camino de conocimiento') {
      return notification.description;
    } else if (notification.verb === 'se registró en tu evento') {
      return notification.description;
    } else if (notification.verb === 'aceptó tu pago para') {
      return notification.description;
    } else if (notification.verb === 'te envió un certificado para') {
      return notification.description;
    } else if (notification.verb === 'te invitó a moderar') {
      if (notification.description) {
        // Si hay un mensaje opcional después de los dos puntos, dividirlo
        // Formato esperado: "usuario te invitó a moderar el tema "título": mensaje opcional"
        // Buscamos el patrón: " después de las comillas del título, hay un : seguido de espacio
        const match = notification.description.match(/^(.+?":\s)(.+)$/);
        if (match && match.length === 3) {
          // match[1] = "usuario te invitó a moderar el tema "título": "
          // match[2] = mensaje opcional
          return (
            <>
              {match[1].trim()}
              <br />
              <br />
              {match[2]}
            </>);

        }
        // Fallback: intentar dividir por el primer ": " después de las comillas de cierre
        const quoteIndex = notification.description.lastIndexOf('"');
        if (quoteIndex !== -1) {
          const colonIndex = notification.description.indexOf(': ', quoteIndex);
          if (colonIndex !== -1) {
            const mainMessage = notification.description.substring(0, colonIndex + 1).trim();
            const optionalMessage = notification.description.substring(colonIndex + 2).trim();
            return (
              <>
                {mainMessage}
                <br />
                <br />
                {optionalMessage}
              </>);

          }
        }
        return notification.description;
      }
      return `${notification.actor} te invitó a moderar`;
    } else if (notification.verb === 'aceptó tu invitación para moderar') {
      return notification.description || `${notification.actor} aceptó tu invitación para moderar`;
    } else if (notification.verb === 'rechazó tu invitación para moderar') {
      return notification.description || `${notification.actor} rechazó tu invitación para moderar`;
    } else if (notification.verb === 'te removió como moderador de') {
      return notification.description || `${notification.actor} te removió como moderador`;
    } else if (notification.verb === 'sugirió contenido para') {
      return notification.description || `${notification.actor} sugirió contenido`;
    } else if (notification.verb === 'aceptó tu sugerencia de contenido para') {
      return notification.description || `${notification.actor} aceptó tu sugerencia de contenido`;
    } else if (notification.verb === 'rechazó tu sugerencia de contenido para') {
      return notification.description || `${notification.actor} rechazó tu sugerencia de contenido`;
    } else if (notification.verb === 'sugirió un archivo para tu contenido') {
      return notification.description || `${notification.actor} sugirió un archivo para tu contenido`;
    }
    // Fallback: use description if available, otherwise construct a message
    if (notification.description) {
      return notification.description;
    }
    return `${notification.actor} ${notification.verb}${notification.context_title ? ` en ${notification.context_title}` : ''}`;
  };

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            fontSize: {
              xs: "1.5rem", // ~24px on mobile
              sm: "1.75rem", // ~28px on small screens
              md: "2.125rem" // ~34px on desktop (default h4)
            },
            fontWeight: 600
          }}>
          
          Notificaciones
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="outlined" onClick={onMarkAllAsRead}>
          Marcar todas como leídas
        </Button>
      </Box>
      {loading ?
      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <Stack alignItems="center" spacing={1.5}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Cargando notificaciones...
            </Typography>
          </Stack>
        </Box> :
      error ?
      <Alert severity="error">{error}</Alert> :
      notifications.length === 0 ?
      <Alert severity="info">No se encontraron notificaciones</Alert> :

      <Stack spacing={2}>
          {notifications.map((notification) => {

          return (
            <Paper
              key={notification.id}
              variant="outlined"
              sx={{
                p: 2,
                borderColor: notification.unread ? 'primary.light' : 'divider',
                bgcolor: notification.unread ? 'action.hover' : 'background.paper'
              }}>
              
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {notification.actor && notification.actor_id ?
                      <MuiLink component={Link} to={`/profiles/user_profile/${notification.actor_id}`} underline="hover">
                          {notification.actor}
                        </MuiLink> :

                      notification.actor
                      }
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(notification.timestamp).toLocaleString()}
                      </Typography>
                    </Box>

                    <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                      {getNotificationDescription(notification)}
                      </Typography>
                    {notification.target_url &&
                    <MuiLink
                      component={Link}
                      to={notification.target_url}
                      underline="none"
                      color="text.secondary"
                      sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                      
                        <ApiIcon sx={{ fontSize: 20 }} />
                      </MuiLink>
                    }
                    </Box>
                  </Box>

                  {notification.unread &&
                <Tooltip title="Marcar como leída" arrow>
                      <IconButton
                    color="primary"
                    onClick={() => onMarkAsRead(notification.id)}>
                    
                        <CheckCircleIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    </Tooltip>
                }
                </Box>
              </Paper>);

        })}
        </Stack>
      }
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textAlign: 'center', display: 'block', mt: 2.5, fontStyle: 'italic' }}>
        
        Las notificaciones leídas se eliminan después de 30 días
      </Typography>
    </Container>);

};

export default Notifications;