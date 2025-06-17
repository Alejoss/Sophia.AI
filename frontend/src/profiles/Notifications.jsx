import React, { useState, useEffect } from 'react';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../api/profilesApi';
import '../styles/notifications.css';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await getNotifications(true); // Always show all notifications
      setNotifications(response.notifications);
      setError(null);
    } catch (err) {
      setError('Failed to fetch notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      fetchNotifications();
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      fetchNotifications();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const hasUnreadNotifications = notifications.some(n => n.unread);

  if (loading) return (
    <div className="notifications-container">
      <div className="loading-spinner">Loading notifications...</div>
    </div>
  );
  
  if (error) return (
    <div className="notifications-container">
      <div className="error-message">{error}</div>
    </div>
  );

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <div className="header-content">
          <h2>Notifications</h2>
          <div className="header-actions">
            <span className="notification-count">{notifications.length} notifications</span>
            {hasUnreadNotifications && (
              <button 
                className="mark-all-read-button"
                onClick={handleMarkAllAsRead}
              >
                Mark All as Read
              </button>
            )}
          </div>
        </div>
      </div>
      
      {notifications.length === 0 ? (
        <div className="empty-state">
          <p>No notifications found</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => (
            <div key={notification.id} className={`notification-item ${notification.unread ? 'unread' : ''}`}>
              <div className="notification-content">
                <div className="notification-header">
                  <p className="notification-text">{notification.verb}</p>
                  <span className="notification-timestamp">
                    {new Date(notification.timestamp).toLocaleString()}
                  </span>
                </div>
                {notification.description && (
                  <p className="notification-description">{notification.description}</p>
                )}
              </div>
              <div className="notification-actions">
                {notification.unread && (
                  <button 
                    className="mark-read-button"
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    Mark as Read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications; 