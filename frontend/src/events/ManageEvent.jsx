import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchEventById, getEventParticipants, updateParticipantStatus } from '../api/eventsApi';
import certificatesApi from '../api/certificatesApi';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Snackbar
} from '@mui/material';
import '../styles/events.css';

const ManageEvent = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('participants');
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [certificateDialogOpen, setCertificateDialogOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [certificateNote, setCertificateNote] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [paymentConfirmationDialog, setPaymentConfirmationDialog] = useState(false);
  const [selectedPaymentRegistration, setSelectedPaymentRegistration] = useState(null);

  useEffect(() => {
    loadEventData();
  }, [eventId]);

  const loadEventData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [eventData, participantsData] = await Promise.all([
        fetchEventById(eventId),
        getEventParticipants(eventId)
      ]);
      
      setEvent(eventData);
      setParticipants(participantsData);
    } catch (err) {
      console.error('Error loading event data:', err);
      setError(err.error || 'Failed to load event data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentStatusLabel = (paymentStatus) => {
    const statusMap = {
      'PENDING': 'Payment Pending',
      'PAID': 'Payment Accepted',
      'REFUNDED': 'Payment Refunded'
    };
    return statusMap[paymentStatus] || paymentStatus;
  };

  const getRegistrationStatusLabel = (registrationStatus) => {
    const statusMap = {
      'REGISTERED': 'Registered',
      'CANCELLED': 'Cancelled'
    };
    return statusMap[registrationStatus] || registrationStatus;
  };

  const canSendCertificate = (registration) => {
    // Must be registered (not cancelled)
    if (registration.registration_status !== 'REGISTERED') {
      return false;
    }
    
    // Event must have ended
    if (!event.date_end || new Date(event.date_end) >= new Date()) {
      return false;
    }
    
    // For paid events, payment must be accepted
    if (event.reference_price > 0) {
      return registration.payment_status === 'PAID';
    }
    
    // For free events, can send certificate after event ends
    return true;
  };

  const hasCertificate = (registration) => {
    // Check if the registration has a certificate based on the API response
    return registration.has_certificate === true;
  };

  const hasEventEnded = () => {
    return event.date_end && new Date(event.date_end) <= new Date();
  };

  const handleMessageUser = (userId) => {
    window.open(`/messages/thread/${userId}`, '_blank');
  };

  const handleStatusUpdate = async (registrationId, action) => {
    try {
      setUpdatingStatus(registrationId);
      setError(null);
      
      await updateParticipantStatus(eventId, registrationId, action);
      
      // Refresh participants list
      const participantsData = await getEventParticipants(eventId);
      setParticipants(participantsData);
      
      // Show success message for certificate generation
      if (action === 'send_certificate') {
        setSnackbar({
          open: true,
          message: 'Certificate generated and sent successfully!',
          severity: 'success'
        });
      }
    } catch (err) {
      console.error('Error updating participant status:', err);
      setError(err.error || 'Failed to update participant status');
      setSnackbar({
        open: true,
        message: err.error || 'Failed to update participant status',
        severity: 'error'
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const openCertificateDialog = (registration) => {
    setSelectedRegistration(registration);
    setCertificateNote('');
    setCertificateDialogOpen(true);
  };

  const openPaymentConfirmationDialog = (registration) => {
    setSelectedPaymentRegistration(registration);
    setPaymentConfirmationDialog(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedPaymentRegistration) return;

    try {
      setUpdatingStatus(selectedPaymentRegistration.id);
      setPaymentConfirmationDialog(false);
      setError(null);
      
      await updateParticipantStatus(eventId, selectedPaymentRegistration.id, 'accept_payment');
      
      // Refresh participants list
      const participantsData = await getEventParticipants(eventId);
      setParticipants(participantsData);
      
      setSnackbar({
        open: true,
        message: 'Payment accepted successfully!',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error accepting payment:', err);
      const errorMessage = err.error || 'Failed to accept payment';
      setError(errorMessage);
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setUpdatingStatus(null);
      setSelectedPaymentRegistration(null);
    }
  };

  const handleGenerateCertificate = async () => {
    if (!selectedRegistration) return;

    try {
      setUpdatingStatus(selectedRegistration.id);
      setCertificateDialogOpen(false);
      setError(null);
      
      // Use the new certificate generation API
      const result = await certificatesApi.generateEventCertificate(
        eventId, 
        selectedRegistration.id, 
        {
          note: certificateNote
        }
      );
      
      // Refresh participants list
      const participantsData = await getEventParticipants(eventId);
      setParticipants(participantsData);
      
      setSnackbar({
        open: true,
        message: 'Certificate generated and sent successfully!',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error generating certificate:', err);
      const errorMessage = err.error || err.details || 'Failed to generate certificate';
      setError(errorMessage);
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setUpdatingStatus(null);
      setSelectedRegistration(null);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  if (loading) {
    return (
      <div className="events-list-container">
        <div className="text-center">
          <h2>Manage Event</h2>
          <div className="loading-spinner">Loading event data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="events-list-container">
        <div className="text-center">
          <h2>Manage Event</h2>
          <div className="error-message">{error}</div>
          <Link to="/events" className="btn btn-primary">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="events-list-container">
        <div className="text-center">
          <h2>Manage Event</h2>
          <p>Event not found.</p>
          <Link to="/events" className="btn btn-primary">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="events-list-container">
      <div className="events-header">
        <h2>Manage Event: {event.title}</h2>
        <div className="events-header-actions">
          <Link to={`/events/${eventId}`} className="btn btn-secondary">
            View Event
          </Link>
          <Link to={`/events/${eventId}/edit`} className="btn btn-primary">
            Edit Event
          </Link>
        </div>
      </div>

      {/* Event Summary */}
      <div className="event-summary-card">
        <div className="event-summary-header">
          <h3>Event Summary</h3>
        </div>
        <div className="event-summary-content">
          <div className="summary-grid">
            <div className="summary-item">
              <strong>Event Type:</strong>
              <span>{event.event_type}</span>
            </div>
            <div className="summary-item">
              <strong>Start Date:</strong>
              <span>{formatDate(event.date_start)}</span>
            </div>
            <div className="summary-item">
              <strong>End Date:</strong>
              <span>{formatDate(event.date_end)}</span>
            </div>
            <div className="summary-item">
              <strong>Platform:</strong>
              <span>{event.platform || 'Not specified'}</span>
            </div>
            <div className="summary-item">
              <strong>Price:</strong>
              <span>{event.reference_price > 0 ? `$${event.reference_price}` : 'Free'}</span>
            </div>
            <div className="summary-item">
              <strong>Participants:</strong>
              <span>{participants.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="events-tabs">
        <button 
          className={`tab-button ${activeTab === 'participants' ? 'active' : ''}`}
          onClick={() => setActiveTab('participants')}
        >
          Participants ({participants.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'participants' && (
          <div>
            {participants.length === 0 ? (
              <div className="text-center">
                <p>No participants registered yet.</p>
              </div>
            ) : (
              <div className="participants-list">
                {participants.map((registration) => (
                  <div key={registration.id} className="participant-item">
                    <div className="participant-info">
                      <div className="participant-main">
                        <strong>{registration.user.username}</strong>
                        <span className="participant-email">{registration.user_email}</span>
                      </div>
                      <div className="participant-status">
                        <span className={`registration-badge ${registration.registration_status.toLowerCase()}`}>
                          {getRegistrationStatusLabel(registration.registration_status)}
                        </span>
                        <span className={`payment-badge ${registration.payment_status.toLowerCase()}`}>
                          {getPaymentStatusLabel(registration.payment_status)}
                        </span>
                      </div>
                    </div>
                    <div className="participant-actions">
                      <div className="participant-date">
                        Registered: {formatDate(registration.registered_at)}
                      </div>
                      <div className="participant-buttons">
                        <button 
                          className="btn btn-primary message-btn"
                          onClick={() => handleMessageUser(registration.user.id)}
                        >
                          Message User
                        </button>
                        
                        {/* Only show actions for registered participants */}
                        {registration.registration_status === 'REGISTERED' && (
                          <>
                            {/* Accept Payment - only for paid events with pending payment */}
                            {event.reference_price > 0 && registration.payment_status === 'PENDING' && (
                              <button 
                                className="btn btn-success action-btn"
                                onClick={() => openPaymentConfirmationDialog(registration)}
                                disabled={updatingStatus === registration.id}
                              >
                                {updatingStatus === registration.id ? 'Updating...' : 'Accept Payment'}
                              </button>
                            )}
                            
                            {/* Send Certificate - after event end date and payment accepted (or free event) */}
                            {canSendCertificate(registration) && (
                              <button 
                                className={`btn ${hasCertificate(registration) ? 'btn-secondary' : 'btn-info'} action-btn`}
                                onClick={() => hasCertificate(registration) ? null : openCertificateDialog(registration)}
                                disabled={updatingStatus === registration.id || hasCertificate(registration)}
                              >
                                {updatingStatus === registration.id ? 'Sending...' : 
                                 hasCertificate(registration) ? 'Certificate Sent' : 'Send Certificate'}
                              </button>
                            )}
                            
                            {/* Cancel Registration - only show if event hasn't ended */}
                            {!hasEventEnded() && (
                              <button 
                                className="btn btn-danger action-btn"
                                onClick={() => handleStatusUpdate(registration.id, 'cancel_registration')}
                                disabled={updatingStatus === registration.id}
                              >
                                {updatingStatus === registration.id ? 'Cancelling...' : 'Cancel Registration'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Certificate Generation Dialog */}
      <Dialog 
        open={certificateDialogOpen} 
        onClose={() => setCertificateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Send Certificate</DialogTitle>
        <DialogContent>
          <div style={{ marginTop: '16px' }}>
            <Alert severity="info" style={{ marginBottom: '16px' }}>
              <strong>Note:</strong> Any message you add below will be visible to the student on their certificate.
            </Alert>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Personal Message (optional)"
              placeholder="Add a personal message to congratulate the student or add any special notes..."
              value={certificateNote}
              onChange={(e) => setCertificateNote(e.target.value)}
              variant="outlined"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCertificateDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleGenerateCertificate}
            variant="contained"
            color="primary"
          >
            Send Certificate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Confirmation Dialog */}
      <Dialog 
        open={paymentConfirmationDialog} 
        onClose={() => setPaymentConfirmationDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Payment Acceptance</DialogTitle>
        <DialogContent>
          <div style={{ marginTop: '16px' }}>
            <Alert severity="warning" style={{ marginBottom: '16px' }}>
              <strong>Important:</strong> This action will mark the payment as accepted and cannot be undone.
            </Alert>
            {selectedPaymentRegistration && (
              <div style={{ marginBottom: '16px' }}>
                <p><strong>User:</strong> {selectedPaymentRegistration.user.username}</p>
                <p><strong>Email:</strong> {selectedPaymentRegistration.user_email}</p>
                <p><strong>Event:</strong> {event.title}</p>
                <p><strong>Amount:</strong> ${event.reference_price}</p>
              </div>
            )}
            <p>Are you sure you want to accept this payment?</p>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentConfirmationDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmPayment}
            variant="contained"
            color="success"
          >
            Accept Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default ManageEvent; 