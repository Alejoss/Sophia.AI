import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchEvents } from '../api/eventsApi';
import '../styles/events.css';

const EventsList = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchEvents();
      setEvents(data);
    } catch (err) {
      console.error('Error loading events:', err);
      if (err.detail) {
        setError(err.detail);
      } else if (typeof err === 'string') {
        setError(err);
      } else {
        setError('Error al cargar eventos. Por favor, inténtelo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  const getEventTypeLabel = (eventType) => {
    const typeMap = {
      'LIVE_COURSE': 'Curso en Vivo',
      'LIVE_CERTIFICATION': 'Certificación en Vivo',
      'LIVE_MASTER_CLASS': 'Clase Magistral en Vivo'
    };
    return typeMap[eventType] || eventType;
  };

  const getPlatformLabel = (platform) => {
    const platformMap = {
      'google_meet': 'Google Meet',
      'jitsi': 'Jitsi',
      'microsoft_teams': 'Microsoft Teams',
      'other': 'Other',
      'telegram': 'Telegram',
      'tox': 'Tox',
      'twitch': 'Twitch',
      'zoom': 'Zoom'
    };
    return platformMap[platform] || platform;
  };

  if (loading) {
    return (
      <div className="events-list-container">
        <div className="text-center">
          <h2>Eventos</h2>
          <div className="loading-spinner">Cargando eventos...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="events-list-container">
        <div className="text-center">
          <h2>Eventos</h2>
          <div className="error-message">{error}</div>
          <button onClick={loadEvents} className="btn btn-primary">
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="events-list-container">
      <div className="events-header">
        <h2>Eventos</h2>
        <div className="events-header-actions">
          <Link to="/events/create" className="btn btn-primary">
            Crear Evento
          </Link>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="text-center">
          <p>No se encontraron eventos.</p>
          <Link to="/events/create" className="btn btn-primary">
            Crear tu Primer Evento
          </Link>
        </div>
      ) : (
        <div className="events-grid">
          {events.map((event) => (
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
                <h3>{event.title || 'Evento sin título'}</h3>
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
                    : 'No hay descripción disponible'}
                </p>
                
                <div className="event-meta">
                  <div className="event-info">
                    <strong>Anfitrión:</strong> {event.owner?.username || 'Desconocido'}
                  </div>
                  
                  {event.platform && (
                    <div className="event-info">
                      <strong>Plataforma:</strong> {getPlatformLabel(event.platform)}
                      {event.platform === 'other' && event.other_platform && (
                        <span> ({event.other_platform})</span>
                      )}
                    </div>
                  )}
                  
                  {event.reference_price > 0 && (
                    <div className="event-info">
                      <strong>Precio:</strong> ${event.reference_price}
                    </div>
                  )}
                  
                  <div className="event-info">
                    <strong>Inicio:</strong> {formatDate(event.date_start)}
                  </div>
                  
                  {event.date_end && (
                    <div className="event-info">
                      <strong>Fin:</strong> {formatDate(event.date_end)}
                    </div>
                  )}
                  

                </div>
              </div>
              
              <div className="event-actions">
                <Link to={`/events/${event.id}`} className="btn btn-secondary">
                  Ver Detalles
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventsList;
