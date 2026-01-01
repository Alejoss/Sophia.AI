import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Avatar } from '@mui/material';
import knowledgePathsApi from '../api/knowledgePathsApi';
import certificatesApi from '../api/certificatesApi';
import commentsApi from '../api/commentsApi';
import { AuthContext } from '../context/AuthContext';
import { Lock, LockOpen, CheckCircle } from '@mui/icons-material';
import CommentSection from '../comments/CommentSection';
import VoteComponent from '../votes/VoteComponent';
import BookmarkButton from '../bookmarks/BookmarkButton';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography
} from '@mui/material';

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
          setError('Por favor inicia sesión para ver esta ruta de conocimiento');
        } else {
          setError('Error al cargar la ruta de conocimiento');
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
    if (certificateStatus?.certificate_request?.status === 'APPROVED') {
      return (
        <div className="mt-6 text-center">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-100 text-green-800">
            <CheckCircle className="mr-2" />
            <span>Has obtenido un certificado por completar esta ruta de conocimiento</span>
          </div>
        </div>
      );
    }

    if (certificateStatus?.has_certificate) {
      return (
        <div className="mt-6 text-center">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-100 text-green-800">
            <CheckCircle className="mr-2" />
            <span>Has obtenido un certificado por completar esta ruta de conocimiento</span>
          </div>
        </div>
      );
    }

    if (certificateStatus?.certificate_request) {
      const request = certificateStatus.certificate_request;
      switch (request.status) {
        case 'PENDING':
          return (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-yellow-100 text-yellow-800">
                <span>Solicitud de certificado pendiente de revisión</span>
              </div>
              <button
                onClick={handleCancelRequest}
                disabled={requestingCertificate}
                className="mt-2 px-4 py-1 text-sm text-red-600 hover:text-red-800"
              >
                {requestingCertificate ? 'Cancelando...' : 'Cancelar Solicitud'}
              </button>
            </div>
          );
        case 'REJECTED':
          return (
            <div className="mt-6 text-center">
              <div className="inline-flex flex-col items-center px-4 py-2 rounded-full bg-red-100 text-red-800">
                <span>La solicitud de certificado fue rechazada</span>
                {request.rejection_reason && (
                  <div className="mt-2 text-sm font-medium">
                    Razón: {request.rejection_reason}
                  </div>
                )}
              </div>
              {isCreator && (
                <button
                  onClick={handleAcceptRejectedRequest}
                  disabled={requestingCertificate}
                  className="mt-2 px-4 py-1 text-sm text-green-600 hover:text-green-800"
                >
                  {requestingCertificate ? 'Aceptando...' : 'Aceptar Solicitud'}
                </button>
              )}
              {!isCreator && (
                <button
                  onClick={handleOpenModal}
                  disabled={requestingCertificate}
                  className="mt-2 px-4 py-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  {requestingCertificate ? 'Solicitando...' : 'Solicitar Nuevamente'}
                </button>
              )}
            </div>
          );
        case 'CANCELLED':
          return (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-gray-100 text-gray-800">
                <span>La solicitud de certificado fue cancelada</span>
              </div>
              <button
                onClick={handleOpenModal}
                disabled={requestingCertificate}
                className="mt-2 px-4 py-1 text-sm text-blue-600 hover:text-blue-800"
              >
                {requestingCertificate ? 'Solicitando...' : 'Solicitar Nuevamente'}
              </button>
            </div>
          );
        default:
          return null;
      }
    }

    return (
      <div className="mt-6 flex justify-center">
        <button
          onClick={handleOpenModal}
          disabled={requestingCertificate}
          className={`px-6 py-2 rounded-lg font-medium transition-colors
            ${requestingCertificate 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-green-500 hover:bg-green-600 text-white'}`}
        >
          {requestingCertificate ? 'Solicitando...' : 'Solicitar Certificado'}
        </button>
      </div>
    );
  };

  // Memoize the certificate status section to prevent unnecessary re-renders
  const certificateStatusSection = React.useMemo(() => renderCertificateStatus(), [
    hasCompleted,
    certificateStatus,
    requestingCertificate
  ]);

  if (loading) return <div className="text-center py-8">Cargando...</div>;
  if (error) return <div className="text-red-500 text-center py-8">{error}</div>;
  if (!knowledgePath && !error) return <div className="text-center py-8">Ruta de conocimiento no encontrada</div>;

  return (
    <div className="container mx-auto md:p-4">
      <div className="bg-white rounded-lg shadow-lg md:p-6 px-2 py-4">
        {/* Header with Image */}
        <div className="md:flex items-start mb-6">
          <Avatar 
            src={knowledgePath.image} 
            alt={knowledgePath.title}
            sx={{ 
              width: 120, 
              height: 120, 
              mr: 4,
              bgcolor: 'grey.300',
              fontSize: '3rem',
              flexShrink: 0
            }}
          >
            {knowledgePath.title.charAt(0).toUpperCase()}
          </Avatar>
          
          <div className="md:flex-1 md:mt-0 mt-4 min-w-0">
            <div className="md:flex justify-between items-start">
              <div>
                <h1 className="md:!text-3xl !text-xl font-bold mb-2 text-gray-900">{knowledgePath.title}</h1>
                <p className="text-gray-600">
                  Creado por{' '}
                  <Link 
                    to={`/profiles/user_profile/${knowledgePath.author_id}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {knowledgePath.author}
                  </Link>
                </p>
                {isCreator && pendingRequests > 0 && (
                  <button
                    onClick={handleViewCertificateRequests}
                    className="mt-2 inline-flex items-center px-4 py-2 rounded-lg bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors"
                  >
                    <span>Tienes {pendingRequests} solicitud{pendingRequests !== 1 ? 'es' : ''} de certificado pendiente{pendingRequests !== 1 ? 's' : ''}</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4">
                <BookmarkButton 
                  contentId={pathId}
                  contentType="knowledgepath"
                />
                <VoteComponent 
                  type="knowledge_path"
                  ids={{ pathId }}
                  initialVoteCount={Number(knowledgePath.vote_count) || 0}
                  initialUserVote={Number(knowledgePath.user_vote) || 0}
                />
                {isCreator && (
                  <Link
                    to={`/knowledge_path/${pathId}/edit`}
                    className="bg-blue-500 hover:bg-blue-700 !text-white !no-underline font-bold py-2 px-4 rounded transition-colors"
                  >
                    Editar Ruta
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {!isCreator && knowledgePath.progress && (
          <div className="mb-6">
            <div className="bg-gray-200 rounded-full h-4 mb-2">
              <div 
                className="bg-blue-500 rounded-full h-4 transition-all duration-500"
                style={{ width: `${knowledgePath.progress.percentage}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              Completados {knowledgePath.progress.completed_nodes} de {knowledgePath.progress.total_nodes} nodos
            </p>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2 text-gray-900">Descripción</h2>
          <p className="text-gray-700">{knowledgePath.description}</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Nodos de Contenido</h2>
            {knowledgePath.progress?.is_completed && (
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                Completado
              </span>
            )}
          </div>
          {knowledgePath.nodes?.length > 0 ? (
            <div className="space-y-4">
              {knowledgePath.nodes.map((node, index) => {
                return (
                  <div 
                    key={node.id}
                    className={`flex items-center p-4 rounded-lg border 
                      ${node.is_available ? 'bg-gray-50 border-gray-200' : 'bg-gray-100 border-gray-300'}`}
                  >
                    <span className="font-bold text-gray-500 mr-4">{index + 1}</span>
                    <div className="flex-grow">
                      {node.is_available ? (
                        <Link 
                          to={`/knowledge_path/${pathId}/nodes/${node.id}`}
                          className="font-medium text-gray-900 hover:text-blue-500"
                        >
                          {node.title}
                        </Link>
                      ) : (
                        <span className="text-gray-500">{node.title}</span>
                      )}
                      <span className="text-sm text-gray-500 ml-2">{node.media_type}</span>
                    </div>
                    <div className="flex items-center">
                      {node.is_completed && <CheckCircle className="text-green-500 mr-2" />}
                      {!node.is_available && !isCreator && <Lock className="text-gray-500" />}
                      {node.is_available && !node.is_completed && <LockOpen className="text-blue-500" />}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500">Aún no se han agregado nodos de contenido</p>
          )}

          {/* Certificate Status Section */}
          {certificateStatusSection}
        </div>

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
                placeholder="Opcionalmente agrega una nota al creador de la ruta de conocimiento"
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
          <div className="mt-8 border-t pt-6">
            <CommentSection 
              knowledgePathId={pathId}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgePathDetail; 