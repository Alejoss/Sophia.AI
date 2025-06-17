import React, { useState, useEffect, useContext } from 'react';
import certificatesApi from '../api/certificatesApi';
import { AuthContext } from '../context/AuthContext';
import {
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Box,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';

const Certificates = () => {
  const [activeTab, setActiveTab] = useState('certificates');
  const [certificates, setCertificates] = useState([]);
  const [requests, setRequests] = useState([]);
  const [certificatesLoading, setCertificatesLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const { authState } = useContext(AuthContext);

  useEffect(() => {
    if (activeTab === 'certificates') {
      fetchCertificates();
    } else if (activeTab === 'requests') {
      fetchRequests();
    }
  }, [activeTab]);

  const fetchCertificates = async () => {
    try {
      setCertificatesLoading(true);
      const data = await certificatesApi.getCertificates();
      setCertificates(data);
    } catch (err) {
      setError('Failed to load certificates');
      console.error(err);
    } finally {
      setCertificatesLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      setRequestsLoading(true);
      const data = await certificatesApi.getCertificateRequests();
      setRequests(data);
    } catch (err) {
      setError('Failed to load certificate requests');
      console.error(err);
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    try {
      await certificatesApi.approveCertificateRequest(selectedRequest.id, approveNote);
      setApproveDialogOpen(false);
      setApproveNote('');
      setSelectedRequest(null);
      fetchRequests();
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
      fetchRequests();
    } catch (err) {
      setError('Failed to reject request');
      console.error(err);
    }
  };

  const handleCancel = async (requestId) => {
    try {
      await certificatesApi.cancelCertificateRequest(requestId);
      fetchRequests();
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
    const pendingRequests = requests.filter(req => req.status === 'PENDING');
    const nonPendingRequests = requests.filter(req => req.status !== 'PENDING');
    nonPendingRequests.sort((a, b) => new Date(b.request_date) - new Date(a.request_date));
    return [...pendingRequests, ...nonPendingRequests];
  };

  return (
    <div>
      {/* Tabs */}
      <div className="profile-tabs">
        <button 
          className={`tab ${activeTab === 'certificates' ? 'active' : ''}`}
          onClick={() => setActiveTab('certificates')}
        >
          My Certificates
        </button>
        <button 
          className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Certificate Requests
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'certificates' && (
          <div className="certificates">
            {certificatesLoading ? (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error">{error}</Alert>
            ) : certificates.length === 0 ? (
              <Typography variant="body1" color="textSecondary">
                You haven't earned any certificates yet. Complete knowledge paths to earn certificates!
              </Typography>
            ) : (
              <div className="grid gap-4">
                {certificates.map((certificate) => (
                  <Card key={certificate.id} className="mb-4">
                    <CardContent>
                      <div className="flex justify-between items-start">
                        <div>
                          <Typography variant="h6">
                            {certificate.knowledge_path_title}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Issued on: {new Date(certificate.issued_on).toLocaleDateString()}
                          </Typography>
                          {certificate.blockchain_hash && (
                            <Chip
                              label="On Blockchain"
                              color="success"
                              size="small"
                              className="mt-2"
                            />
                          )}
                        </div>
                        {certificate.download_url && (
                          <Button
                            variant="contained"
                            color="primary"
                            href={certificate.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Download
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'requests' && (
          <div className="requests">
            {requestsLoading ? (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error">{error}</Alert>
            ) : requests.length === 0 ? (
              <Typography variant="body1" color="textSecondary">
                No certificate requests found.
              </Typography>
            ) : (
              <div className="space-y-8">
                {/* Teacher View */}
                {requests.filter(req => req.knowledge_path_author === authState.user?.username).length > 0 && (
                  <div>
                    <Typography variant="h5" gutterBottom>
                      Requests to Review
                    </Typography>
                    {sortRequests(requests.filter(req => req.knowledge_path_author === authState.user?.username)).map((request) => (
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
                              {request.status === 'PENDING' && (
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
                              {request.status === 'REJECTED' && (
                                <Button
                                  variant="contained"
                                  color="success"
                                  onClick={() => openApproveDialog(request)}
                                >
                                  Accept Request
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
                    ))}
                  </div>
                )}

                {/* Student View */}
                {requests.filter(req => req.requester === authState.user?.username).length > 0 && (
                  <div>
                    <Typography variant="h5" gutterBottom>
                      My Requests
                    </Typography>
                    {sortRequests(requests.filter(req => req.requester === authState.user?.username)).map((request) => (
                      <Card key={request.id} className="mb-4">
                        <CardContent>
                          <div className="flex justify-between items-start">
                            <div>
                              <Typography variant="h6">
                                {request.knowledge_path_title}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                Requested on: {new Date(request.request_date).toLocaleDateString()}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                Author: {request.knowledge_path_author}
                              </Typography>
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
                            {request.status === 'PENDING' && (
                              <Button
                                variant="outlined"
                                color="error"
                                onClick={() => handleCancel(request.id)}
                              >
                                Cancel
                              </Button>
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
              </div>
            )}
          </div>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)}>
        <DialogTitle>Approve Certificate Request</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Note (optional)"
            type="text"
            fullWidth
            multiline
            rows={4}
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleApprove} color="primary">
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)}>
        <DialogTitle>Reject Certificate Request</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Reason for rejection"
            type="text"
            fullWidth
            required
            multiline
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Note (optional)"
            type="text"
            fullWidth
            multiline
            rows={4}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
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

export default Certificates;
