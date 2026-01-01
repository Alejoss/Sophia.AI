import React from 'react';
import { Link } from 'react-router-dom';
import ApiIcon from '@mui/icons-material/Api';
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
    if (notification.verb === 'comentó en tu ruta de conocimiento') {
      return `${notification.actor} comentó en tu ruta de conocimiento ${notification.context_title}`;
    } else if (notification.verb === 'respondió a') {
      return `${notification.actor} respondió a tu comentario en ${notification.context_title}`;
    } else if (notification.verb === 'completó tu ruta de conocimiento') {
      return notification.description;
    } else if (notification.verb === 'solicitó un certificado para tu ruta de conocimiento') {
      return notification.description;
    } else if (notification.verb === 'aprobó tu solicitud de certificado para') {
      return notification.description;
    } else if (notification.verb === 'rechazó tu solicitud de certificado para') {
      return notification.description;
    } else if (notification.verb === 'votó positivamente tu contenido') {
      return notification.description;
    } else if (notification.verb === 'votó positivamente tu ruta de conocimiento') {
      return notification.description;
    } else if (notification.verb === 'se registró en tu evento') {
      return notification.description;
    } else if (notification.verb === 'aceptó tu pago para') {
      return notification.description;
    } else if (notification.verb === 'te envió un certificado para') {
      return notification.description;
    }
    return `${notification.actor} ${notification.verb} tu comentario en ${notification.context_title}`;
  };

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <div className="header-content">
          <h2>Notificaciones</h2>          
        </div>
      </div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p className="notification-description">
                      {getNotificationDescription(notification)}
                    </p>
                    {notification.target_url && (
                      <Link 
                        to={notification.target_url} 
                        className="notification-view-link"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          color: '#666',
                          textDecoration: 'none',
                          marginLeft: '16px'
                        }}
                      >
                        <ApiIcon style={{ fontSize: '20px' }} />
                      </Link>
                    )}
                  </div>
                </div>
                <div className="notification-actions">
                  {notification.unread && (
                    <button 
                      className="mark-read-button"
                      onClick={() => onMarkAsRead(notification.id)}
                    >
                      Marcar como leída
                    </button>
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