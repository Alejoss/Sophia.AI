import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import certificatesApi from '../api/certificatesApi';
import { AuthContext } from '../context/AuthContext';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Box,
  Chip,
  Divider
} from '@mui/material';

const CertificateRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const { authState } = useContext(AuthContext);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await certificatesApi.getCertificateRequests();
      setRequests(data);
    } catch (err) {
      setError('Failed to load certificate requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    try {
      await certificatesApi.approveCertificateRequest(selectedRequest.id, approveNote);
      setApproveDialogOpen(false);
      setApproveNote('');
      setSelectedRequest(null);
      fetchRequests(); // Refresh the list
    } catch (err) {
      setError('Failed to approve request');
      console.error(err);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    try {
      await certificatesApi.rejectCertificateRequest(selectedRequest.id, rejectReason, rejectNote);
      setRejectDialogOpen(false);
      setRejectReason('');
      setRejectNote('');
      setSelectedRequest(null);
      fetchRequests(); // Refresh the list
    } catch (err) {
      setError('Failed to reject request');
      console.error(err);
    }
  };

  const handleCancel = async (requestId) => {
    try {
      await certificatesApi.cancelCertificateRequest(requestId);
      fetchRequests(); // Refresh the list
    } catch (err) {
      setError('Failed to cancel request');
      console.error(err);
    }
  };

  const openApproveDialog = (request) => {
    setSelectedRequest(request);
    setApproveDialogOpen(true);
  };

  const openRejectDialog = (request) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'error';
      default:
        return 'default';
    }
  };

  const sortRequests = (requests) => {
    // First, separate requests into pending and non-pending
    const pendingRequests = requests.filter(req => req.status === 'PENDING');
    const nonPendingRequests = requests.filter(req => req.status !== 'PENDING');

    // Sort non-pending requests by date (newest first)
    nonPendingRequests.sort((a, b) => new Date(b.request_date) - new Date(a.request_date));

    // Return combined array with pending requests first
    return [...pendingRequests, ...nonPendingRequests];
  };

  const renderRequests = (requests, isTeacherView = false) => {
    const sortedRequests = sortRequests(requests);

    return sortedRequests.map((request) => {
      // Debug logs for each request
      console.log('Request data:', {
        id: request.id,
        status: request.status,
        knowledge_path_author: request.knowledge_path_author,
        current_user: authState.user?.username,
        isTeacher: request.knowledge_path_author === authState.user?.username,
        isRejected: request.status === 'REJECTED'
      });

      return (
        <Card key={request.id} className="mb-4">
          <CardContent>
            <div className="flex justify-between items-start">
              <div>
                <Typography variant="h6">
                  {request.knowledge_path_title}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {isTeacherView ? `Requested by: ${request.requester}` : `Requested on: ${new Date(request.request_date).toLocaleDateString()}`}
                </Typography>
                {!isTeacherView && (
                  <Typography variant="body2" color="textSecondary">
                    Author: {request.knowledge_path_author}
                  </Typography>
                )}
                <Chip
                  label={request.status}
                  color={getStatusColor(request.status)}
                  size="small"
                  className="mt-2"
                />
                {request.notes && 
                 ((typeof request.notes === 'object' && Object.keys(request.notes).length > 0) || 
                  (typeof request.notes === 'string' && request.notes.trim() !== '')) && (
                  <Typography variant="body2" className="mt-2">
                    Notes: {typeof request.notes === 'object' ? JSON.stringify(request.notes) : request.notes}
                  </Typography>
                )}
              </div>

              <div className="flex gap-2">
                {request.status === 'PENDING' && request.knowledge_path_author === authState.user?.username && (
                  <>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={() => openApproveDialog(request)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="contained"
                      color="error"
                      onClick={() => openRejectDialog(request)}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {request.status === 'REJECTED' && request.knowledge_path_author === authState.user?.username && (
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => openApproveDialog(request)}
                  >
                    Accept Request
                  </Button>
                )}
                {request.status === 'PENDING' && request.requester === authState.user?.username && (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => handleCancel(request.id)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {request.rejection_reason && (
              <Typography variant="body2" color="error" className="mt-2">
                Rejection reason: {request.rejection_reason}
              </Typography>
            )}
          </CardContent>
        </Card>
      );
    });
  };

  // Add debug logs for the requests data
  useEffect(() => {
    console.log('All requests:', requests);
    console.log('Teacher requests:', requests.filter(req => req.knowledge_path_author === authState.user?.username));
    console.log('Student requests:', requests.filter(req => req.requester === authState.user?.username));
    console.log('Current user:', authState.user?.username);
  }, [requests, authState.user]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  // Separate requests into teacher view (requests to review) and student view (own requests)
  const teacherRequests = requests.filter(req => req.knowledge_path_author === authState.user?.username);
  const studentRequests = requests.filter(req => req.requester === authState.user?.username);

  return (
    <div className="container mx-auto p-4">
      <Typography variant="h4" gutterBottom>
        Certificate Requests
      </Typography>

      {requests.length === 0 ? (
        <Typography variant="body1" color="textSecondary">
          No certificate requests found.
        </Typography>
      ) : (
        <div className="space-y-8">
          {/* Teacher View */}
          {teacherRequests.length > 0 && (
            <div>
              <Typography variant="h5" gutterBottom>
                Requests to Review
              </Typography>
              {renderRequests(teacherRequests, true)}
            </div>
          )}

          {/* Student View */}
          {studentRequests.length > 0 && (
            <div>
              <Typography variant="h5" gutterBottom>
                My Requests
              </Typography>
              {renderRequests(studentRequests, false)}
            </div>
          )}
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog 
        open={approveDialogOpen} 
        onClose={() => setApproveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Approve Certificate Request</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Optional note"
              placeholder="Optionally add a note to the student"
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              variant="outlined"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleApprove}
            variant="contained"
            color="success"
          >
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog 
        open={rejectDialogOpen} 
        onClose={() => setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Certificate Request</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              margin="dense"
              label="Rejection Reason"
              multiline
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              required
            />
            <TextField
              fullWidth
              margin="dense"
              label="Optional note"
              multiline
              rows={4}
              placeholder="Optionally add a note to the student"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleReject}
            variant="contained"
            color="error"
            disabled={!rejectReason.trim()}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default CertificateRequests; 