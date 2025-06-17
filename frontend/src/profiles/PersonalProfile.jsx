import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getUserProfile, getNotifications, markNotificationAsRead } from '../api/profilesApi';
import PublicationList from '../publications/PublicationList';
import './PersonalProfile.css';

const PersonalProfile = () => {
  const { authState } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('publications');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProfile();
    fetchNotifications();
  }, []);

  const fetchProfile = async () => {
    try {
      const profileData = await getUserProfile();
      setProfile(profileData);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const notifications = await getNotifications();
      setNotifications(notifications);
      setError(null);
    } catch (err) {
      setError('Failed to fetch notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      await fetchNotifications();
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {/* Tabs */}
      <div className="profile-tabs">
        <button 
          className={`tab ${activeTab === 'publications' ? 'active' : ''}`}
          onClick={() => setActiveTab('publications')}
        >
          Publications
        </button>
        <button 
          className={`tab ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          Notifications {unreadCount > 0 && `(${unreadCount})`}
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'publications' && (
          <div className="publications">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Your Publications</h3>
              <Link 
                to="/publications/create"
                style={{
                  backgroundColor: '#1976d2',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  textDecoration: 'none',
                }}
              >
                Create Publication
              </Link>
            </div>
            <PublicationList isOwnProfile={true} />
          </div>
        )}
        {activeTab === 'activity' && (
          <div className="notifications-container">
            <div className="notifications-header">
              <div className="header-content">
                <h2>Notifications</h2>
                <span className="notification-count">{notifications.length} notifications</span>
              </div>
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
        )}
      </div>
    </div>
  );
};

export default PersonalProfile;