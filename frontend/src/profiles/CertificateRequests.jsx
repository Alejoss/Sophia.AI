import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import certificatesApi from '../api/certificatesApi';
import { AuthContext } from '../context/AuthContext';
import {
  Container,
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
  Stack,
  Link as MuiLink } from
'@mui/material';
import { applyApiErrorsToForm } from '../utils/apiFormErrors.js';

const rejectSchema = yup.object({
  reason: yup
    .string()
    .trim()
    .required('El motivo del rechazo es requerido.'),
});

const CertificateRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approveNote, setApproveNote] = useState('');
  const [rejectGeneralError, setRejectGeneralError] = useState('');
  const { authState } = useContext(AuthContext);

  const {
    register: registerReject,
    handleSubmit: handleRejectSubmit,
    reset: resetRejectForm,
    setError: setRejectFormError,
    formState: { errors: rejectErrors, isSubmitting: isRejectSubmitting },
  } = useForm({
    resolver: yupResolver(rejectSchema),
    defaultValues: { reason: '' },
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await certificatesApi.getCertificateRequests();
      setRequests(data);
    } catch (err) {
      setError('Error al cargar las solicitudes de certificados');
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
      setError('Error al aprobar la solicitud');
      console.error(err);
    }
  };

  const onRejectSubmit = async ({ reason }) => {
    if (!selectedRequest) return;

    setRejectGeneralError('');

    try {
      await certificatesApi.rejectCertificateRequest(selectedRequest.id, reason);
      setRejectDialogOpen(false);
      resetRejectForm({ reason: '' });
      setSelectedRequest(null);
      fetchRequests();
    } catch (err) {
      const { generalError } = applyApiErrorsToForm(
        err,
        setRejectFormError,
        'Error al rechazar la solicitud',
        { rejection_reason: 'reason' },
      );
      if (generalError) {
        setRejectGeneralError(generalError);
      }
    }
  };

  const handleCancel = async (requestId) => {
    try {
      await certificatesApi.cancelCertificateRequest(requestId);
      fetchRequests(); // Refresh the list
    } catch (err) {
      setError('Error al cancelar la solicitud');
      console.error(err);
    }
  };

  const openApproveDialog = (request) => {
    setSelectedRequest(request);
    setApproveDialogOpen(true);
  };

  const openRejectDialog = (request) => {
    setSelectedRequest(request);
    resetRejectForm({ reason: '' });
    setRejectGeneralError('');
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
    const pendingRequests = requests.filter((req) => req.status === 'PENDING');
    const nonPendingRequests = requests.filter((req) => req.status !== 'PENDING');

    // Sort non-pending requests by date (newest first)
    nonPendingRequests.sort((a, b) => new Date(b.request_date) - new Date(a.request_date));

    // Return combined array with pending requests first
    return [...pendingRequests, ...nonPendingRequests];
  };

  const renderRequests = (requests, isTeacherView = false) => {
    const sortedRequests = sortRequests(requests);

    return sortedRequests.map((request) => {
      // Debug logs for each request


      return (
        <Card key={request.id} sx={{ mb: 2 }}>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 2,
                flexWrap: 'wrap'
              }}>
              
              <Box sx={{ flex: 1, minWidth: 240 }}>
                <Typography variant="h6" color="text.primary">
                  {request.knowledge_path_title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isTeacherView ?
                  <>
                      Solicitado por:{' '}
                      <MuiLink
                      component={Link}
                      to={`/profiles/user_profile/${request.requester_id}`}
                      underline="hover">
                      
                        {request.requester}
                      </MuiLink>
                    </> :

                  `Solicitado el: ${new Date(request.request_date).toLocaleDateString()}`
                  }
                </Typography>
                {!isTeacherView &&
                <Typography variant="body2" color="text.secondary">
                    Autor: {request.knowledge_path_author}
                  </Typography>
                }
                <Chip
                  label={request.status}
                  color={getStatusColor(request.status)}
                  size="small"
                  sx={{ mt: 1 }} />
                
                {request.notes && (
                typeof request.notes === 'object' && Object.keys(request.notes).length > 0 ||
                typeof request.notes === 'string' && request.notes.trim() !== '') &&
                <Typography variant="body2" sx={{ mt: 1 }}>
                    Notas: {typeof request.notes === 'object' ? JSON.stringify(request.notes) : request.notes}
                  </Typography>
                }
              </Box>

              <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                {request.status === 'PENDING' && request.knowledge_path_author === authState.user?.username &&
                <>
                    <Button
                    variant="contained"
                    color="success"
                    onClick={() => openApproveDialog(request)}>
                    
                      Aprobar
                    </Button>
                    <Button
                    variant="contained"
                    color="error"
                    onClick={() => openRejectDialog(request)}>
                    
                      Rechazar
                    </Button>
                  </>
                }
                {request.status === 'REJECTED' && request.knowledge_path_author === authState.user?.username &&
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => openApproveDialog(request)}>
                  
                    Aceptar solicitud
                  </Button>
                }
                {request.status === 'PENDING' && request.requester === authState.user?.username &&
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => handleCancel(request.id)}>
                  
                    Cancelar
                  </Button>
                }
              </Stack>
            </Box>

            {request.rejection_reason &&
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                Motivo del rechazo: {request.rejection_reason}
              </Typography>
            }
          </CardContent>
        </Card>);

    });
  };

  // Add debug logs for the requests data
  useEffect(() => {


  }, [requests, authState.user]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>);

  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  // Separate requests into teacher view (requests to review) and student view (own requests)
  const teacherRequests = requests.filter((req) => req.knowledge_path_author === authState.user?.username);
  const studentRequests = requests.filter((req) => req.requester === authState.user?.username);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography
        variant="h4"
        gutterBottom
        color="text.primary"
        sx={{ fontWeight: 600 }}>
        
        Solicitudes de certificados
      </Typography>

      {requests.length === 0 ?
      <Typography variant="body1" color="text.secondary">
          No se encontraron solicitudes de certificados.
        </Typography> :

      <Stack spacing={4}>
          {/* Teacher View */}
          {teacherRequests.length > 0 &&
        <Box>
              <Typography
            variant="h5"
            gutterBottom
            color="text.primary"
            sx={{ fontWeight: 600 }}>
            
                Solicitudes para revisar
              </Typography>
              {renderRequests(teacherRequests, true)}
            </Box>
        }

          {/* Student View */}
          {studentRequests.length > 0 &&
        <Box>
              <Typography
            variant="h5"
            gutterBottom
            color="text.primary"
            sx={{ fontWeight: 600 }}>
            
                Mis solicitudes
              </Typography>
              {renderRequests(studentRequests, false)}
            </Box>
        }
        </Stack>
      }

      {/* Approve Dialog */}
      <Dialog
        open={approveDialogOpen}
        onClose={() => setApproveDialogOpen(false)}
        maxWidth="sm"
        fullWidth>
        
        <DialogTitle>Aprobar solicitud de certificado</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Nota opcional"
              placeholder="Opcionalmente agrega una nota al estudiante"
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              variant="outlined" />
            
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleApprove}
            variant="contained"
            color="success">
            
            Aprobar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => !isRejectSubmitting && setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth>

        <Box component="form" onSubmit={handleRejectSubmit(onRejectSubmit)} noValidate>
          <DialogTitle>Rechazar solicitud de certificado</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              {rejectGeneralError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {rejectGeneralError}
                </Alert>
              )}
              <TextField
                fullWidth
                margin="dense"
                label="Motivo del rechazo"
                multiline
                rows={2}
                error={!!rejectErrors.reason}
                helperText={rejectErrors.reason?.message}
                disabled={isRejectSubmitting}
                {...registerReject('reason')}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRejectDialogOpen(false)} disabled={isRejectSubmitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="error"
              disabled={isRejectSubmitting}
            >
              {isRejectSubmitting ? 'Rechazando...' : 'Rechazar'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Container>);

};

export default CertificateRequests;