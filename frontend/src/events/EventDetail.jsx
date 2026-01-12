import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchEventById, registerForEvent, cancelEventRegistration, getUserEventRegistrations } from '../api/eventsApi';
import { AuthContext } from '../context/AuthContext';
import '../styles/events.css';

const EventDetail = () => {
  const { eventId } = useParams();
  const { authState } = useContext(AuthContext);
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [shareButtonText, setShareButtonText] = useState('Compartir Evento');
  const [userRegistration, setUserRegistration] = useState(null);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        setLoading(true);
        const data = await fetchEventById(eventId);
        console.log('Event data loaded:', data); // Debug log
        setEvent(data);
        
        // Check if user is registered for this event
        if (authState.isAuthenticated && data.owner.id !== authState.user?.id) {
          try {
            // Try to get user's registrations to check if they're registered for this event
            const userRegistrations = await getUserEventRegistrations();
            const userRegistration = userRegistrations.find(
              reg => reg.event === parseInt(eventId)
            );
            setIsRegistered(!!userRegistration);
            setUserRegistration(userRegistration || null);
          } catch (err) {
            // If there's an error, assume not registered
            setIsRegistered(false);
            setUserRegistration(null);
          }
        }

      } catch (err) {
        setError('Error al cargar el evento. Por favor, inténtelo de nuevo.');
        console.error('Error loading event:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId, authState.isAuthenticated, authState.user]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Por determinar';
      return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
      'other': 'Otra',
      'telegram': 'Telegram',
      'tox': 'Tox',
      'twitch': 'Twitch',
      'zoom': 'Zoom'
    };
    return platformMap[platform] || platform;
  };

  const isEventCreator = () => {
    return authState.isAuthenticated && event?.owner?.id === authState.user?.id;
  };

  const isEventStarted = () => {
    if (!event?.date_start) return false;
    return new Date(event.date_start) < new Date();
  };

  const handleRegister = async () => {
    if (!authState.isAuthenticated) {
      setError('Por favor, inicie sesión para registrarse en eventos');
      return;
    }

    if (isEventStarted()) {
      setError('No se puede registrar en eventos que ya han comenzado');
      return;
    }

    // Show confirmation modal first
    setShowRegistrationModal(true);
  };

  const confirmRegistration = async () => {
    try {
      setRegistrationLoading(true);
      setError(null);
      await registerForEvent(eventId);
      setIsRegistered(true);
      setShowRegistrationModal(false);
    } catch (err) {
      const errorMessage = err.error || err.detail || 'Error al registrarse en el evento';
      setError(errorMessage);
    } finally {
      setRegistrationLoading(false);
    }
  };

  const cancelRegistrationModal = () => {
    setShowRegistrationModal(false);
  };

  const handleCancelRegistration = async () => {
    // Check if payment has been accepted
    if (userRegistration && userRegistration.payment_status === 'PAID') {
      setError('No se puede cancelar el registro después de que el pago haya sido aceptado');
      return;
    }

    try {
      setRegistrationLoading(true);
      setError(null);
      await cancelEventRegistration(eventId);
      setIsRegistered(false);
      setUserRegistration(null);
    } catch (err) {
      const errorMessage = err.error || err.detail || 'Error al cancelar el registro';
      setError(errorMessage);
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handleShareEvent = async () => {
    try {
      const eventUrl = `${window.location.origin}/events/${eventId}`;
      await navigator.clipboard.writeText(eventUrl);
      
      // Update button text to show success
      setShareButtonText('¡URL Copiada!');
      
      // Reset button text after 2 seconds
      setTimeout(() => {
        setShareButtonText('Compartir Evento');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
      // Fallback for older browsers
      const eventUrl = `${window.location.origin}/events/${eventId}`;
      const textArea = document.createElement('textarea');
      textArea.value = eventUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setShareButtonText('¡URL Copiada!');
      setTimeout(() => {
        setShareButtonText('Compartir Evento');
      }, 2000);
    }
  };

  const handleContactCreator = () => {
    if (!authState.isAuthenticated) {
      navigate('/profiles/login');
      return;
    }
    navigate(`/messages/thread/${event.owner.id}`);
  };

  if (loading) {
    return (
      <div className="event-detail-container">
        <div className="text-center">
          <h2>Detalles del Evento</h2>
          <p>Cargando evento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="event-detail-container">
        <div className="text-center">
          <h2>Detalles del Evento</h2>
          <p style={{ color: 'red' }}>{error}</p>
          <Link to="/events" className="btn btn-primary">Volver a Eventos</Link>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="event-detail-container">
        <div className="text-center">
          <h2>Detalles del Evento</h2>
          <p>Evento no encontrado.</p>
          <Link to="/events" className="btn btn-primary">Volver a Eventos</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="event-detail-container">
      <div className="event-detail-header">
        <Link to="/events" className="btn btn-secondary">
          ← Volver a Eventos
        </Link>
        <h1>{event.title}</h1>
        <span className={`event-type-badge ${event.event_type.toLowerCase()}`}>
          {getEventTypeLabel(event.event_type)}
        </span>
      </div>

      <div className="event-detail-content">
        <div className="event-main-info">
          {event.image ? (
            <div className="event-detail-image-container">
              <img 
                src={event.image} 
                alt={event.title} 
                className="event-detail-image"
                onLoad={() => console.log('Event image loaded successfully:', event.image)}
                onError={(e) => {
                  console.error('Failed to load event image:', event.image);
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div className="event-detail-image-placeholder" style={{ display: 'none' }}>
                <div className="placeholder-content">
                  <span>📅</span>
                  <h3>{event.title}</h3>
                </div>
              </div>
            </div>
          ) : (
            <div className="event-detail-image-container">
              <div className="event-detail-image-placeholder">
                <div className="placeholder-content">
                  <span>📅</span>
                  <h3>{event.title}</h3>
                </div>
              </div>
            </div>
          )}
          <div className="event-description">
            <h3>Descripción</h3>
            <p>{event.description}</p>
          </div>

          <div className="event-meta-grid">
            <div className="event-meta-item">
              <strong>Host:</strong>
              <span>
                <Link to={`/profiles/user_profile/${event.owner.id}`} className="host-link">
                  {event.owner.username}
                </Link>
              </span>
            </div>

            {event.platform && (
              <div className="event-meta-item">
                <strong>Plataforma:</strong>
                <span>
                  {getPlatformLabel(event.platform)}
                  {event.platform === 'other' && event.other_platform && (
                    <span> ({event.other_platform})</span>
                  )}
                </span>
              </div>
            )}

            <div className="event-meta-item">
              <strong>Creado:</strong>
              <span>{formatDate(event.date_created)}</span>
            </div>

            {event.reference_price > 0 && (
              <div className="event-meta-item">
                <strong>Precio:</strong>
                <span>${event.reference_price}</span>
                {event.owner_accepted_cryptos && event.owner_accepted_cryptos.length > 0 && (
                  <div className="crypto-payment-methods">
                    <div className="crypto-thumbnails">
                      {event.owner_accepted_cryptos.map((acceptedCrypto) => (
                        <div key={acceptedCrypto.id} className="crypto-thumbnail" title={`${acceptedCrypto.crypto.name} (${acceptedCrypto.crypto.code})`}>
                          {acceptedCrypto.crypto.thumbnail ? (
                            <img 
                              src={acceptedCrypto.crypto.thumbnail} 
                              alt={acceptedCrypto.crypto.name}
                              className="crypto-icon"
                            />
                          ) : (
                            <div className="crypto-icon-placeholder">
                              {acceptedCrypto.crypto.code}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="event-meta-item">
              <strong>Fecha de Inicio:</strong>
              <span>{formatDate(event.date_start)}</span>
            </div>

            {event.date_end && (
              <div className="event-meta-item">
                <strong>Fecha de Fin:</strong>
                <span>{formatDate(event.date_end)}</span>
              </div>
            )}

            {event.date_recorded && (
              <div className="event-meta-item">
                <strong>Fecha Grabada:</strong>
                <span>{formatDate(event.date_recorded)}</span>
              </div>
            )}

            {event.schedule_description && (
              <div className="event-meta-item">
                <strong>Horario:</strong>
                <span>{event.schedule_description}</span>
              </div>
            )}
          </div>
        </div>

        <div className="event-actions">
          {isEventCreator() && (
            <>
              <Link to={`/events/${eventId}/edit`} className="btn btn-primary">
                Editar Evento
              </Link>
              <Link to={`/events/${eventId}/manage`} className="btn btn-secondary">
                Gestionar Evento
              </Link>
            </>
          )}
          
          {!isEventCreator() && authState.isAuthenticated && (
            <>
              {!isRegistered ? (
                <button 
                  onClick={handleRegister}
                  disabled={registrationLoading || isEventStarted()}
                  className={`btn ${isEventStarted() ? 'btn-disabled' : 'btn-primary'}`}
                  title={isEventStarted() ? 'El evento ya ha comenzado' : ''}
                >
                  {registrationLoading ? 'Registrando...' : isEventStarted() ? 'Evento Iniciado' : 'Unirse al Evento'}
                </button>
              ) : (
                <button 
                  onClick={handleCancelRegistration}
                  disabled={registrationLoading || (userRegistration && userRegistration.payment_status === 'PAID')}
                  className={`btn ${userRegistration && userRegistration.payment_status === 'PAID' ? 'btn-disabled' : 'btn-danger'}`}
                  title={userRegistration && userRegistration.payment_status === 'PAID' ? 'No se puede cancelar después de que el pago sea aceptado' : ''}
                >
                  {registrationLoading ? 'Cancelando...' : 
                   userRegistration && userRegistration.payment_status === 'PAID' ? 'Pago Aceptado' : 'Cancelar Registro'}
                </button>
              )}
            </>
          )}
          
          {!authState.isAuthenticated && (
            <Link to="/profiles/login" className="btn btn-primary">
              Iniciar Sesión para Unirse al Evento
            </Link>
          )}
          
          <button className="btn btn-outline" onClick={handleShareEvent}>
            {shareButtonText}
          </button>
          
          {!isEventCreator() && authState.isAuthenticated && isRegistered && (
            <button className="btn btn-info" onClick={handleContactCreator}>
              Contactar al Creador
            </button>
          )}
        </div>
      </div>

      {/* Registration Confirmation Modal */}
      {showRegistrationModal && (
        <div className="modal-overlay" onClick={cancelRegistrationModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirmar Registro en el Evento</h3>
              <button 
                className="modal-close"
                onClick={cancelRegistrationModal}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="registration-notification">
                <div className="notification-icon">📧</div>
                <h4>Confirmación de Registro</h4>
                <p>
                  Estás a punto de registrarte en <strong>{event.title}</strong>.
                </p>
                <p>
                  <strong>Importante:</strong> El creador del evento se pondrá en contacto contigo 
                  para proporcionarte más detalles sobre cómo unirte al evento.
                </p>
                <p>
                  <strong>Revisa tu bandeja de entrada de Academia Blockchain y tu correo electrónico</strong> para 
                  recibir comunicación del creador del evento.
                </p>
                <div className="event-summary">
                  <div className="summary-item">
                    <strong>Evento:</strong> {event.title}
                  </div>
                  <div className="summary-item">
                    <strong>Anfitrión:</strong> {event.owner.username}
                  </div>
                  <div className="summary-item">
                    <strong>Fecha:</strong> {formatDate(event.date_start)}
                  </div>
                  {event.reference_price > 0 && (
                    <div className="summary-item">
                      <strong>Precio:</strong> ${event.reference_price}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={cancelRegistrationModal}
                disabled={registrationLoading}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-primary"
                onClick={confirmRegistration}
                disabled={registrationLoading}
              >
                {registrationLoading ? 'Registrando...' : 'Confirmar Registro'}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default EventDetail;
