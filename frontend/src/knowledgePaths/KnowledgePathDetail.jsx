import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Container,
  Paper,
  Box,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Card,
  CardContent,
  Alert,
  AlertTitle,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Lock,
  LockOpen,
  CheckCircle,
  Edit,
  School,
  Description,
  ArrowForward,
  NotificationsActive,
} from '@mui/icons-material';
import knowledgePathsApi from '../api/knowledgePathsApi';
import certificatesApi from '../api/certificatesApi';
import commentsApi from '../api/commentsApi';
import { AuthContext } from '../context/AuthContext';
import CommentSection from '../comments/CommentSection';
import VoteComponent from '../votes/VoteComponent';
import BookmarkButton from '../bookmarks/BookmarkButton';

// TODO: Add a progress bar to the knowledge path detail page
const KnowledgePathDetail = () => {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const { authState } = useContext(AuthContext);
  const user = authState.user;
  const [knowledgePath, setKnowledgePath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [isCreator, setIsCreator] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [hasCompleted, setHasCompleted] = useState(false);
  const [requestingCertificate, setRequestingCertificate] = useState(false);
  const [certificateRequested, setCertificateRequested] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [certificateStatus, setCertificateStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    const fetchKnowledgePath = async () => {
      try {
        const data = await knowledgePathsApi.getKnowledgePath(pathId);
        setKnowledgePath(data);
        setIsCreator(user?.username === data.author);
        setHasCompleted(data.progress?.is_completed || false);

        // If user is the author, fetch pending certificate requests
        if (user?.username === data.author) {
          try {
            const requestsData = await certificatesApi.getKnowledgePathCertificateRequests(pathId);
            setPendingRequests(requestsData.count);
          } catch (error) {
            console.error('Error fetching pending certificate requests:', error);
          }
        }

        if (data.progress?.is_completed) {
          const commentsData = await commentsApi.getKnowledgePathComments(pathId);
          setComments(commentsData);
          
          try {
            const statusData = await certificatesApi.getCertificateRequestStatus(pathId);
            setCertificateStatus(statusData);
          } catch (error) {
            console.error('Error fetching certificate status:', error);
          }
        }
      } catch (err) {
        if (err.response?.status === 401) {
          // The axios interceptor will handle the redirect to login
          setError('Por favor inicia sesión para ver este camino de conocimiento');
        } else {
          setError('Error al cargar el camino de conocimiento');
        }
      } finally {
        setLoading(false);
        setLoadingStatus(false);
      }
    };

    fetchKnowledgePath();
  }, [pathId, user?.username, authState.isAuthenticated, authState.user]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const response = await commentsApi.addKnowledgePathComment(pathId, newComment);
      setComments([...comments, response]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setRequestNote('');
  };

  const handleRequestCertificate = async () => {
    try {
      setRequestingCertificate(true);
      setError(null);
      setErrorDetails(null);
      await certificatesApi.requestCertificate(pathId, { notes: requestNote });
      setCertificateRequested(true);
      const statusData = await certificatesApi.getCertificateRequestStatus(pathId);
      setCertificateStatus(statusData);
      handleCloseModal();
    } catch (error) {
      console.error('Error requesting certificate:', error);
      const errorMessage = error.response?.data?.error || 'Error al solicitar el certificado';
      const errorDetails = error.response?.data?.details || error.message;
      setError(errorMessage);
      setErrorDetails(errorDetails);
    } finally {
      setRequestingCertificate(false);
    }
  };

  const handleCancelRequest = async () => {
    try {
      setRequestingCertificate(true);
      setError(null);
      setErrorDetails(null);
      await certificatesApi.cancelCertificateRequest(certificateStatus.certificate_request.id);
      const statusData = await certificatesApi.getCertificateRequestStatus(pathId);
      setCertificateStatus(statusData);
    } catch (error) {
      console.error('Error cancelling certificate request:', error);
      const errorMessage = error.response?.data?.error || 'Error al cancelar la solicitud de certificado';
      const errorDetails = error.response?.data?.details || error.message;
      setError(errorMessage);
      setErrorDetails(errorDetails);
    } finally {
      setRequestingCertificate(false);
    }
  };

  const handleAcceptRejectedRequest = async () => {
    try {
      setRequestingCertificate(true);
      setError(null);
      setErrorDetails(null);
      await certificatesApi.approveCertificateRequest(certificateStatus.certificate_request.id);
      const statusData = await certificatesApi.getCertificateRequestStatus(pathId);
      setCertificateStatus(statusData);
    } catch (error) {
      console.error('Error accepting certificate request:', error);
      const errorMessage = error.response?.data?.error || 'Error al aceptar la solicitud de certificado';
      const errorDetails = error.response?.data?.details || error.message;
      setError(errorMessage);
      setErrorDetails(errorDetails);
    } finally {
      setRequestingCertificate(false);
    }
  };

  const handleViewCertificateRequests = () => {
    navigate('/profiles/certificate-requests');
  };

  const renderCertificateStatus = () => {
    if (!hasCompleted) return null;

    // If there's an approved request, treat it as having a certificate
    if (certificateStatus?.certificate_request?.status === 'APPROVED' || certificateStatus?.has_certificate) {
      return (
        <Box sx={{ mt: 4 }}>
          <Alert 
            severity="success" 
            icon={<CheckCircle />}
            sx={{ borderRadius: 2 }}
          >
            <AlertTitle sx={{ fontWeight: 600 }}>Certificado Obtenido</AlertTitle>
            Has obtenido un certificado por completar este camino de conocimiento
          </Alert>
        </Box>
      );
    }

    if (certificateStatus?.certificate_request) {
      const request = certificateStatus.certificate_request;
      switch (request.status) {
        case 'PENDING':
          return (
            <Box sx={{ mt: 4 }}>
              <Alert 
                severity="warning" 
                sx={{ borderRadius: 2 }}
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={handleCancelRequest}
                    disabled={requestingCertificate}
                  >
                    {requestingCertificate ? 'Cancelando...' : 'Cancelar'}
                  </Button>
                }
              >
                <AlertTitle sx={{ fontWeight: 600 }}>Solicitud Pendiente</AlertTitle>
                Tu solicitud de certificado está pendiente de revisión
              </Alert>
            </Box>
          );
        case 'REJECTED':
          return (
            <Box sx={{ mt: 4 }}>
              <Alert 
                severity="error" 
                sx={{ borderRadius: 2 }}
              >
                <AlertTitle sx={{ fontWeight: 600 }}>Solicitud Rechazada</AlertTitle>
                {request.rejection_reason && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Razón:</strong> {request.rejection_reason}
                  </Typography>
                )}
                <Box sx={{ mt: 2 }}>
                  {isCreator ? (
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      onClick={handleAcceptRejectedRequest}
                      disabled={requestingCertificate}
                      startIcon={<CheckCircle />}
                    >
                      {requestingCertificate ? 'Aceptando...' : 'Aceptar Solicitud'}
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      color="primary"
                      size="small"
                      onClick={handleOpenModal}
                      disabled={requestingCertificate}
                    >
                      {requestingCertificate ? 'Solicitando...' : 'Solicitar Nuevamente'}
                    </Button>
                  )}
                </Box>
              </Alert>
            </Box>
          );
        case 'CANCELLED':
          return (
            <Box sx={{ mt: 4 }}>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                <AlertTitle sx={{ fontWeight: 600 }}>Solicitud Cancelada</AlertTitle>
                Tu solicitud de certificado fue cancelada
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    onClick={handleOpenModal}
                    disabled={requestingCertificate}
                  >
                    {requestingCertificate ? 'Solicitando...' : 'Solicitar Nuevamente'}
                  </Button>
                </Box>
              </Alert>
            </Box>
          );
        default:
          return null;
      }
    }

    return (
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          color="success"
          size="large"
          onClick={handleOpenModal}
          disabled={requestingCertificate}
          startIcon={<School />}
          sx={{ 
            px: 4,
            py: 1.5,
            borderRadius: 2,
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600
          }}
        >
          {requestingCertificate ? 'Solicitando...' : 'Solicitar Certificado'}
        </Button>
      </Box>
    );
  };

  // Memoize the certificate status section to prevent unnecessary re-renders
  const certificateStatusSection = React.useMemo(() => renderCertificateStatus(), [
    hasCompleted,
    certificateStatus,
    requestingCertificate
  ]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      </Container>
    );
  }

  if (!knowledgePath && !error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          <AlertTitle>No encontrado</AlertTitle>
          Camino de conocimiento no encontrado
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      {/* Hero Header Section */}
      <Paper 
        elevation={3} 
        sx={{ 
          mb: 4,
          borderRadius: 3,
          overflow: 'hidden',
          position: 'relative',
          minHeight: { xs: 200, md: 300 },
        }}
      >
        {/* Cover Image */}
        {knowledgePath.image ? (
          <Box
            component="img"
            src={knowledgePath.image}
            alt={knowledgePath.title}
            sx={{
              width: '100%',
              height: { xs: 200, md: 300 },
              objectFit: 'cover',
              objectPosition: knowledgePath.image_focal_x != null && knowledgePath.image_focal_y != null
                ? `${(knowledgePath.image_focal_x * 100).toFixed(1)}% ${(knowledgePath.image_focal_y * 100).toFixed(1)}%`
                : '50% 50%',
              display: 'block',
            }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: { xs: 200, md: 300 },
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: { xs: '4rem', md: '6rem' },
              color: 'white',
              fontWeight: 700,
            }}
          >
            {knowledgePath.title.charAt(0).toUpperCase()}
          </Box>
        )}
        
        {/* Content Overlay */}
        <Box 
          sx={{ 
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            p: { xs: 3, md: 4 },
            background: knowledgePath.image 
              ? 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)'
              : 'transparent',
            color: 'white',
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography 
                variant="h3" 
                component="h1" 
                sx={{ 
                  fontWeight: 700,
                  mb: 1.5,
                  fontSize: { xs: '1.75rem', md: '2.5rem' },
                  textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                  color: 'white',
                }}
              >
                {knowledgePath.title}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2, opacity: 0.95, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                Creado por{' '}
                <Link 
                  to={`/profiles/user_profile/${knowledgePath.author_id}`}
                  style={{ 
                    color: 'white', 
                    fontWeight: 600,
                    textDecoration: 'underline',
                    textDecorationColor: 'rgba(255, 255, 255, 0.7)'
                  }}
                >
                  {knowledgePath.author}
                </Link>
              </Typography>
              {isCreator && pendingRequests > 0 && (
                <Button
                  variant="contained"
                  color="warning"
                  size="small"
                  startIcon={<NotificationsActive />}
                  onClick={handleViewCertificateRequests}
                  sx={{ 
                    mt: 1,
                    bgcolor: 'warning.main',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    '&:hover': {
                      bgcolor: 'warning.dark',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    }
                  }}
                >
                  {pendingRequests} solicitud{pendingRequests !== 1 ? 'es' : ''} pendiente{pendingRequests !== 1 ? 's' : ''}
                </Button>
              )}
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1.5 }}>
              <Box
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: 2,
                  p: 0.5,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}
              >
                <BookmarkButton 
                  contentId={pathId}
                  contentType="knowledgepath"
                />
              </Box>
              <Box
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: 2,
                  p: 0.5,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <VoteComponent 
                  type="knowledge_path"
                  ids={{ pathId }}
                  initialVoteCount={Number(knowledgePath.vote_count) || 0}
                  initialUserVote={Number(knowledgePath.user_vote) || 0}
                />
              </Box>
              {isCreator && (
                <Button
                  component={Link}
                  to={`/knowledge_path/${pathId}/edit`}
                  variant="contained"
                  color="secondary"
                  startIcon={<Edit />}
                  sx={{ 
                    bgcolor: 'secondary.main',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    '&:hover': {
                      bgcolor: 'secondary.dark',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    }
                  }}
                >
                  Editar
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>
      </Paper>

      {/* Progress Section */}
      {!isCreator && knowledgePath.progress && (
        <Paper elevation={2} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1" component="div" sx={{ fontWeight: 600, fontSize: '1.25rem' }}>
                Progreso
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {knowledgePath.progress.completed_nodes} de {knowledgePath.progress.total_nodes} nodos completados
              </Typography>
            </Stack>
            <LinearProgress 
              variant="determinate" 
              value={knowledgePath.progress.percentage || 0} 
              sx={{ 
                height: 10, 
                borderRadius: 5,
                bgcolor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 5,
                  background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                }
              }} 
            />
          </Box>
        </Paper>
      )}

      {/* Description Section */}
      <Paper elevation={2} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Description color="primary" />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Descripción
          </Typography>
        </Stack>
        <Typography
          variant="body1"
          sx={{ color: 'text.secondary', lineHeight: 1.8, whiteSpace: 'pre-line', wordBreak: 'break-word' }}
        >
          {knowledgePath.description}
        </Typography>
      </Paper>

      {/* Nodes Section */}
      <Paper elevation={2} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <School color="primary" />
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Nodos de Contenido
            </Typography>
          </Stack>
          {knowledgePath.progress?.is_completed && (
            <Chip 
              icon={<CheckCircle />}
              label="Completado" 
              color="success" 
              sx={{ fontWeight: 600 }}
            />
          )}
        </Stack>

        {knowledgePath.nodes?.length > 0 ? (
          <Stack spacing={2}>
            {knowledgePath.nodes.map((node, index) => {
              const isLocked = !node.is_available && !isCreator;
              const isCompleted = node.is_completed;
              
              return (
                <Card
                  key={node.id}
                  elevation={isLocked ? 1 : 2}
                  sx={{
                    borderRadius: 2,
                    transition: 'all 0.3s ease',
                    opacity: isLocked ? 0.7 : 1,
                    '&:hover': {
                      elevation: isLocked ? 1 : 4,
                      transform: isLocked ? 'none' : 'translateY(-2px)',
                    }
                  }}
                >
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          minWidth: 40,
                          height: 40,
                          borderRadius: '50%',
                          bgcolor: isCompleted ? 'success.main' : isLocked ? 'grey.300' : 'primary.main',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '1.1rem'
                        }}
                      >
                        {index + 1}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        {node.is_available ? (
                          <Link 
                            to={`/knowledge_path/${pathId}/nodes/${node.id}`}
                            style={{ 
                              textDecoration: 'none',
                              color: 'inherit'
                            }}
                          >
                            <Typography 
                              variant="subtitle1" 
                              component="div"
                              sx={{ 
                                fontWeight: 600,
                                mb: 0.5,
                                color: 'primary.main',
                                fontSize: '1.25rem',
                                '&:hover': {
                                  textDecoration: 'underline'
                                }
                              }}
                            >
                              {node.title}
                            </Typography>
                          </Link>
                        ) : (
                          <Typography 
                            variant="subtitle1" 
                            component="div"
                            sx={{ 
                              fontWeight: 600,
                              mb: 0.5,
                              fontSize: '1.25rem',
                              color: 'text.disabled'
                            }}
                          >
                            {node.title}
                          </Typography>
                        )}
                        <Chip 
                          label={node.media_type} 
                          size="small" 
                          variant="outlined"
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {isCompleted && (
                          <Tooltip title="Completado">
                            <CheckCircle color="success" sx={{ fontSize: 28 }} />
                          </Tooltip>
                        )}
                        {isLocked && (
                          <Tooltip title="Bloqueado">
                            <Lock color="disabled" sx={{ fontSize: 28 }} />
                          </Tooltip>
                        )}
                        {node.is_available && !isCompleted && (
                          <Tooltip title="Disponible">
                            <LockOpen color="primary" sx={{ fontSize: 28 }} />
                          </Tooltip>
                        )}
                        {node.is_available && (
                          <IconButton
                            component={Link}
                            to={`/knowledge_path/${pathId}/nodes/${node.id}`}
                            color="primary"
                            size="small"
                          >
                            <ArrowForward />
                          </IconButton>
                        )}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        ) : (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Aún no se han agregado nodos de contenido
          </Alert>
        )}

        {/* Certificate Status Section */}
        {certificateStatusSection}
      </Paper>

        {/* Certificate Request Modal */}
        <Dialog 
          open={isModalOpen} 
          onClose={handleCloseModal}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Solicitar Certificado</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Mensaje opcional"
                placeholder="Opcionalmente agrega una nota al creador del camino de conocimiento"
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                variant="outlined"
              />
              {error && (
                <Box sx={{ mt: 2, color: 'error.main' }}>
                  <Typography variant="body2" color="error">
                    {error}
                  </Typography>
                  {errorDetails && (
                    <Typography variant="caption" color="error">
                      {typeof errorDetails === 'object' 
                        ? JSON.stringify(errorDetails, null, 2)
                        : errorDetails}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseModal}>Cancelar</Button>
            <Button 
              onClick={handleRequestCertificate}
              variant="contained"
              color="primary"
              disabled={requestingCertificate}
            >
              {requestingCertificate ? 'Enviando...' : 'Enviar Solicitud'}
            </Button>
          </DialogActions>
        </Dialog>

      {/* Comments Section */}
      {(hasCompleted || isCreator) && (
        <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
          <CommentSection 
            knowledgePathId={pathId}
          />
        </Paper>
      )}
    </Container>
  );
};

export default KnowledgePathDetail; 