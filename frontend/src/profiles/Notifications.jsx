import React from 'react';
import { Link } from 'react-router-dom';
import ApiIcon from '@mui/icons-material/Api';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Tooltip, Typography, Box } from '@mui/material';
import '../styles/notifications.css';

const Notifications = ({
  notifications = [],
  loading = false,
  error = null,
  unreadCount = 0,
  onMarkAsRead = () => {},
  onMarkAllAsRead = () => {},
  onRefresh = () => {},
}) => {
  console.log('Notifications prop:', notifications);

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
    } else if (notification.verb === 'votó positivamente tu contenido') {
      return notification.description;
    } else if (notification.verb === 'votó positivamente tu camino de conocimiento') {
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
            </>
          );
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
              </>
            );
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
    }
    // Fallback: use description if available, otherwise construct a message
    if (notification.description) {
      return notification.description;
    }
    return `${notification.actor} ${notification.verb}${notification.context_title ? ` en ${notification.context_title}` : ''}`;
  };

  return (
    <div className="notifications-container">
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            fontSize: {
              xs: "1.5rem", // ~24px on mobile
              sm: "1.75rem", // ~28px on small screens
              md: "2.125rem", // ~34px on desktop (default h4)
            },
            fontWeight: 600,
          }}
        >
          Notificaciones
        </Typography>
      </Box>
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0' }}>
        <button 
          className="mark-all-read-button"
          onClick={onMarkAllAsRead}
        >
          Marcar todas como leídas
        </button>
      </div>
      {loading ? (
        <div className="loading-spinner">Cargando notificaciones...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <p>No se encontraron notificaciones</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => {
            console.log('Notification:', notification);
            return (
              <div key={notification.id} className={`notification-item ${notification.unread ? 'unread' : ''}`}>
                <div className="notification-content">
                  <div className="notification-header">
                    <p className="notification-text">
                      {notification.actor && notification.actor_id ? (
                        <Link to={`/profiles/user_profile/${notification.actor_id}`} className="notification-actor-link">
                          {notification.actor}
                        </Link>
                      ) : (
                        notification.actor
                      )}
                    </p>
                    <span className="notification-timestamp">
                      {new Date(notification.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <br />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="notification-description">
                      {getNotificationDescription(notification)}
                    </div>
                    {notification.target_url && (
                      <Link 
                        to={notification.target_url} 
                        className="notification-view-link"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          color: '#666',
                          textDecoration: 'none',
                          marginLeft: '16px',
                          marginTop: '0'
                        }}
                      >
                        <ApiIcon style={{ fontSize: '20px' }} />
                      </Link>
                    )}
                  </div>
                </div>
                <div className="notification-actions">
                  {notification.unread && (
                    <Tooltip title="Marcar como leída" arrow>
                      <button 
                        className="mark-all-read-button"
                        onClick={() => onMarkAsRead(notification.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '8px'
                        }}
                      >
                        <CheckCircleIcon style={{ fontSize: '20px', color: 'white' }} />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '20px', 
        fontSize: '0.8rem', 
        color: '#666',
        fontStyle: 'italic'
      }}>
        Las notificaciones leídas se eliminan después de 30 días
      </div>
    </div>
  );
};

export default Notifications; 