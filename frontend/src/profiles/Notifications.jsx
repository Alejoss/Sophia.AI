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
    if (notification.verb === 'commented on your knowledge path') {
      return `${notification.actor} commented on your knowledge path ${notification.context_title}`;
    } else if (notification.verb === 'replied to') {
      return `${notification.actor} replied to your comment in ${notification.context_title}`;
    } else if (notification.verb === 'completed your knowledge path') {
      return notification.description;
    } else if (notification.verb === 'requested a certificate for your knowledge path') {
      return notification.description;
    } else if (notification.verb === 'approved your certificate request for') {
      return notification.description;
    } else if (notification.verb === 'rejected your certificate request for') {
      return notification.description;
    } else if (notification.verb === 'upvoted your content') {
      return notification.description;
    } else if (notification.verb === 'upvoted your knowledge path') {
      return notification.description;
    } else if (notification.verb === 'registered for your event') {
      return notification.description;
    } else if (notification.verb === 'accepted your payment for') {
      return notification.description;
    } else if (notification.verb === 'sent you a certificate for') {
      return notification.description;
    }
    return `${notification.actor} ${notification.verb} your comment in ${notification.context_title}`;
  };

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <div className="header-content">
          <h2>Notifications</h2>          
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0' }}>
        <button 
          className="mark-all-read-button"
          onClick={onMarkAllAsRead}
        >
          Mark all as read
        </button>
      </div>
      {loading ? (
        <div className="loading-spinner">Loading notifications...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <p>No notifications found</p>
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
                      Mark as Read
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
        Read notifications are deleted after 30 days
      </div>
    </div>
  );
};

export default Notifications; 