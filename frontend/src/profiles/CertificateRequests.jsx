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
  Chip
} from '@mui/material';

const CertificateRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
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

  const handleApprove = async (requestId) => {
    try {
      await certificatesApi.approveCertificateRequest(requestId);
      fetchRequests(); // Refresh the list
    } catch (err) {
      setError('Failed to approve request');
      console.error(err);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    try {
      await certificatesApi.rejectCertificateRequest(selectedRequest.id, rejectReason);
      setRejectDialogOpen(false);
      setRejectReason('');
      setSelectedRequest(null);
      fetchRequests(); // Refresh the list
    } catch (err) {
      setError('Failed to reject request');
      console.error(err);
    }
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
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id} className="mb-4">
              <CardContent>
                <div className="flex justify-between items-start">
                  <div>
                    <Typography variant="h6">
                      {request.knowledge_path_title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Requested by: {request.requester}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Date: {new Date(request.request_date).toLocaleDateString()}
                    </Typography>
                    <Chip
                      label={request.status}
                      color={getStatusColor(request.status)}
                      size="small"
                      className="mt-2"
                    />
                  </div>

                  {request.status === 'PENDING' && request.knowledge_path_author === authState.user?.username && (
                    <div className="flex gap-2">
                      <Button
                        variant="contained"
                        color="success"
                        onClick={() => handleApprove(request.id)}
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
                    </div>
                  )}
                </div>

                {request.rejection_reason && (
                  <Typography variant="body2" color="error" className="mt-2">
                    Rejection reason: {request.rejection_reason}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)}>
        <DialogTitle>Reject Certificate Request</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Rejection Reason"
            fullWidth
            multiline
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleReject} color="error">
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default CertificateRequests; 