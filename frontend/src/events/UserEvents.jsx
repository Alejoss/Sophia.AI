import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  getUserEventRegistrations, 
  getUserCreatedEvents,
  getUserEventRegistrationsById,
  getUserCreatedEventsById
} from '../api/eventsApi';
import '../styles/events.css';

const UserEvents = ({ isOwnProfile = false, userId = null }) => {
  const [registrations, setRegistrations] = useState([]);
  const [createdEvents, setCreatedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('registrations'); // 'registrations' or 'created'

  useEffect(() => {
    const loadUserEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let registrationsData, createdEventsData;
        
        if (isOwnProfile || !userId) {
          // Owner view - fetch own events
          [registrationsData, createdEventsData] = await Promise.all([
            getUserEventRegistrations(),
            getUserCreatedEvents()
          ]);
        } else {
          // Visitor view - fetch events for specific user
          try {
            // Try to fetch created events for the user
            createdEventsData = await getUserCreatedEventsById(userId);
          } catch (err) {
            console.warn('Could not fetch created events for user:', err);
            // For now, show empty array since backend endpoint doesn't exist
            createdEventsData = [];
          }
          
          // For visitors, we don't show registrations as they are private
          registrationsData = [];
        }
        
        setRegistrations(registrationsData);
        setCreatedEvents(createdEventsData);
      } catch (err) {
        console.error('Error loading user events:', err);
        setError('Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    loadUserEvents();
  }, [isOwnProfile, userId]);

  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventTypeLabel = (eventType) => {
    const typeMap = {
      'LIVE_COURSE': 'Live Course',
      'LIVE_CERTIFICATION': 'Live Certification',
      'LIVE_MASTER_CLASS': 'Live Master Class'
    };
    return typeMap[eventType] || eventType;
  };

  const getPaymentStatusLabel = (paymentStatus) => {
    const paymentMap = {
      'PENDING': 'Pending',
      'PAID': 'Paid',
      'REFUNDED': 'Refunded'
    };
    return paymentMap[paymentStatus] || paymentStatus;
  };

  const getRegistrationStatusLabel = (registrationStatus) => {
    const statusMap = {
      'REGISTERED': 'Registered',
      'CANCELLED': 'Cancelled'
    };
    return statusMap[registrationStatus] || registrationStatus;
  };

  if (loading) {
    return (
      <div className="events-list-container">
        <div className="text-center">
          <h2>{isOwnProfile ? 'My Events' : 'Events'}</h2>
          <div className="loading-spinner">Loading events...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="events-list-container">
        <div className="text-center">
          <h2>{isOwnProfile ? 'My Events' : 'Events'}</h2>
          <div className="error-message">{error}</div>
          <button onClick={() => window.location.reload()} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="events-list-container">
      <div className="events-header">
        <h2>{isOwnProfile ? 'My Events' : 'Events'}</h2>
        <Link to="/events" className="btn btn-secondary">
          Browse All Events
        </Link>
      </div>

      {/* Tab Navigation - Show registrations tab only for owners */}
      {isOwnProfile ? (
        <div className="events-tabs">
          <button 
            className={`tab-button ${activeTab === 'registrations' ? 'active' : ''}`}
            onClick={() => setActiveTab('registrations')}
          >
            Events I'm Registered For ({registrations.length})
          </button>
          <button 
            className={`tab-button ${activeTab === 'created' ? 'active' : ''}`}
            onClick={() => setActiveTab('created')}
          >
            Events I've Created ({createdEvents.length})
          </button>
        </div>
      ) : (
        // For visitors, show created events directly without tabs
        <div style={{ marginBottom: '20px' }}>
          <h3>Created Events ({createdEvents.length})</h3>
        </div>
      )}

      {/* Registrations Tab - Only for owners */}
      {isOwnProfile && activeTab === 'registrations' && (
        <div className="tab-content">
          {registrations.length === 0 ? (
            <div className="text-center">
              <p>You're not registered for any events yet.</p>
              <Link to="/events" className="btn btn-primary">
                Browse Events
              </Link>
            </div>
          ) : (
            <div className="events-grid">
              {registrations.map((registration) => (
                <div key={registration.id} className="event-card">
                  <div className="event-header">
                    <h3>{registration.event_title || 'Untitled Event'}</h3>
                    <div className="registration-status">
                      <span className={`registration-badge ${registration.registration_status.toLowerCase()}`}>
                        {getRegistrationStatusLabel(registration.registration_status)}
                      </span>
                      <span className={`payment-badge ${registration.payment_status.toLowerCase()}`}>
                        {getPaymentStatusLabel(registration.payment_status)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="event-details">
                    <div className="event-meta">
                      <div className="event-info">
                        <strong>Event Date:</strong> {formatDate(registration.event_date)}
                      </div>
                      <div className="event-info">
                        <strong>Registered:</strong> {formatDate(registration.registered_at)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="event-actions">
                    <Link to={`/events/${registration.event}`} className="btn btn-secondary">
                      View Event
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Created Events Tab - For both owners and visitors */}
      {(isOwnProfile && activeTab === 'created') || !isOwnProfile ? (
        <div className="tab-content">
          {createdEvents.length === 0 ? (
            <div className="text-center">
              <p>{isOwnProfile ? 'You haven\'t created any events yet.' : 'No created events found.'}</p>
              {isOwnProfile && (
                <Link to="/events/create" className="btn btn-primary">
                  Create Your First Event
                </Link>
              )}
            </div>
          ) : (
            <div className="events-grid">
              {createdEvents.map((event) => (
                <div key={event.id} className="event-card">
                  {event.image && (
                    <div className="event-image-container">
                      <img 
                        src={event.image} 
                        alt={event.title} 
                        className="event-image"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'block';
                        }}
                      />
                      <div className="event-image-placeholder" style={{ display: 'none' }}>
                        <div className="placeholder-content">
                          <span>📅</span>
                          <p>{event.title}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="event-header">
                    <h3>{event.title || 'Untitled Event'}</h3>
                    <span className={`event-type ${event.event_type?.toLowerCase() || 'unknown'}`}>
                      {getEventTypeLabel(event.event_type)}
                    </span>
                  </div>
                  
                  <div className="event-details">
                    <p className="event-description">
                      {event.description 
                        ? (event.description.length > 150 
                            ? `${event.description.substring(0, 150)}...` 
                            : event.description)
                        : 'No description available'}
                    </p>
                    
                    <div className="event-meta">
                      <div className="event-info">
                        <strong>Start:</strong> {formatDate(event.date_start)}
                      </div>
                      
                      {event.date_end && (
                        <div className="event-info">
                          <strong>End:</strong> {formatDate(event.date_end)}
                        </div>
                      )}
                      
                      {event.reference_price > 0 && (
                        <div className="event-info">
                          <strong>Price:</strong> ${event.reference_price}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="event-actions">
                    <Link to={`/events/${event.id}`} className="btn btn-secondary">
                      View Details
                    </Link>
                    {isOwnProfile && (
                      <>
                        <Link to={`/events/${event.id}/edit`} className="btn btn-primary">
                          Edit
                        </Link>
                        <Link to={`/events/${event.id}/manage`} className="btn btn-outline">
                          Manage
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default UserEvents; 