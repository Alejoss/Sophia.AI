import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Chip, 
  Tabs, 
  Tab, 
  Box, 
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Alert
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import MailIcon from '@mui/icons-material/Mail';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/Pending';
import DeleteIcon from '@mui/icons-material/Delete';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import contentApi from '../api/contentApi';
import { MEDIA_BASE_URL } from '../api/config';

const TopicsUser = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  // Initialize activeTab based on URL parameter
  const getInitialTab = () => {
    if (tabParam === 'suggestions') return 3;
    return 0;
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab()); // 0 = Created, 1 = Moderated, 2 = Invitations, 3 = Suggestions
  
  // Created topics state
  const [createdTopics, setCreatedTopics] = useState([]);
  const [createdLoading, setCreatedLoading] = useState(true);
  const [createdError, setCreatedError] = useState(null);
  
  // Moderated topics state
  const [moderatedTopics, setModeratedTopics] = useState([]);
  const [moderatedLoading, setModeratedLoading] = useState(true);
  const [moderatedError, setModeratedError] = useState(null);
  
  // Invitations state
  const [invitations, setInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [invitationsError, setInvitationsError] = useState(null);
  const [processingInvitation, setProcessingInvitation] = useState({});

  // Content Suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const [deletingSuggestion, setDeletingSuggestion] = useState({});

  const fetchData = async () => {
    // Reset loading states
    setCreatedLoading(true);
    setModeratedLoading(true);
    setInvitationsLoading(true);
    setSuggestionsLoading(true);
    
    // Reset errors
    setCreatedError(null);
    setModeratedError(null);
    setInvitationsError(null);
    setSuggestionsError(null);

    // Fetch created topics
    try {
      const created = await contentApi.getUserTopics('created');
      setCreatedTopics(Array.isArray(created) ? created : []);
    } catch (err) {
      console.error('Error fetching created topics:', err);
      setCreatedError('Error al cargar tus temas creados');
    } finally {
      setCreatedLoading(false);
    }

    // Fetch moderated topics
    try {
      const moderated = await contentApi.getUserTopics('moderated');
      setModeratedTopics(Array.isArray(moderated) ? moderated : []);
    } catch (err) {
      console.error('Error fetching moderated topics:', err);
      setModeratedError('Error al cargar los temas en los que eres moderador');
    } finally {
      setModeratedLoading(false);
    }

    // Fetch invitations
    try {
      const inv = await contentApi.getUserTopicInvitations('PENDING');
      setInvitations(Array.isArray(inv) ? inv : []);
    } catch (err) {
      console.error('Error fetching invitations:', err);
      setInvitationsError('Error al cargar las invitaciones');
    } finally {
      setInvitationsLoading(false);
    }

    // Fetch content suggestions
    try {
      const sugg = await contentApi.getUserContentSuggestions({});
      setSuggestions(Array.isArray(sugg) ? sugg : []);
    } catch (err) {
      console.error('Error fetching content suggestions:', err);
      setSuggestionsError('Error al cargar las sugerencias de contenido');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update tab when URL parameter changes
  useEffect(() => {
    if (tabParam === 'suggestions') {
      setActiveTab(3);
    }
  }, [tabParam]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleAcceptInvitation = async (invitation) => {
    const invitationId = invitation.id;
    const topicId = invitation.topic?.id;
    
    if (!topicId) {
      console.error('Topic ID not found in invitation');
      return;
    }

    setProcessingInvitation(prev => ({ ...prev, [invitationId]: 'accepting' }));

    try {
      await contentApi.acceptTopicModeratorInvitation(topicId, invitationId);
      // Reload all data to refresh moderated topics list
      await fetchData();
      // Switch to "Moderados" tab to show the newly accepted topic
      setActiveTab(1);
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setInvitationsError(err.response?.data?.error || 'Error al aceptar la invitación');
    } finally {
      setProcessingInvitation(prev => {
        const newState = { ...prev };
        delete newState[invitationId];
        return newState;
      });
    }
  };

  const handleDeclineInvitation = async (invitation) => {
    const invitationId = invitation.id;
    const topicId = invitation.topic?.id;
    
    if (!topicId) {
      console.error('Topic ID not found in invitation');
      return;
    }

    setProcessingInvitation(prev => ({ ...prev, [invitationId]: 'declining' }));

    try {
      await contentApi.declineTopicModeratorInvitation(topicId, invitationId);
      // Remove invitation from list
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    } catch (err) {
      console.error('Error declining invitation:', err);
      setInvitationsError(err.response?.data?.error || 'Error al rechazar la invitación');
    } finally {
      setProcessingInvitation(prev => {
        const newState = { ...prev };
        delete newState[invitationId];
        return newState;
      });
    }
  };

  const handleDeleteSuggestion = async (suggestion) => {
    const suggestionId = suggestion.id;
    const topicId = suggestion.topic?.id;
    
    if (!topicId) {
      console.error('Topic ID not found in suggestion');
      return;
    }

    if (!window.confirm('¿Estás seguro de que deseas eliminar esta sugerencia?')) {
      return;
    }

    setDeletingSuggestion(prev => ({ ...prev, [suggestionId]: true }));

    try {
      await contentApi.deleteContentSuggestion(topicId, suggestionId);
      // Remove suggestion from list
      setSuggestions(prev => prev.filter(sugg => sugg.id !== suggestionId));
    } catch (err) {
      console.error('Error deleting suggestion:', err);
      setSuggestionsError(err.response?.data?.error || 'Error al eliminar la sugerencia');
    } finally {
      setDeletingSuggestion(prev => {
        const newState = { ...prev };
        delete newState[suggestionId];
        return newState;
      });
    }
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      PENDING: { 
        label: 'Pendiente', 
        color: 'warning',
        icon: <PendingIcon fontSize="small" />
      },
      ACCEPTED: { 
        label: 'Aceptada', 
        color: 'success',
        icon: <CheckCircleIcon fontSize="small" />
      },
      REJECTED: { 
        label: 'Rechazada', 
        color: 'error',
        icon: <CancelIcon fontSize="small" />
      }
    };
    const config = statusConfig[status] || { label: status, color: 'default', icon: null };
    return (
      <Chip 
        label={config.label} 
        color={config.color} 
        icon={config.icon}
        size="small" 
      />
    );
  };

  const getTopicImageUrl = (topic) => {
    if (topic.topic_image) {
      return topic.topic_image.startsWith('http') 
        ? topic.topic_image 
        : `${MEDIA_BASE_URL}${topic.topic_image}`;
    }
    return null;
  };

  const isLoading = createdLoading || moderatedLoading || invitationsLoading || suggestionsLoading;
  const currentError = activeTab === 0 ? createdError : 
                       activeTab === 1 ? moderatedError : 
                       activeTab === 2 ? invitationsError : 
                       suggestionsError;

  return (
    <div className="container mx-auto p-4">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: { xs: 'wrap', md: 'nowrap' }, gap: 2, mb: 4 }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            fontSize: {
              xs: "1.5rem",
              sm: "1.75rem",
              md: "2.125rem",
            },
            fontWeight: 600,
          }}
        >
          Temas
        </Typography>
        <Link 
          to="/content/create_topic"
          className="bg-blue-500 hover:bg-blue-700 !text-white !no-underline font-bold py-2 px-4 rounded transition-colors"
        >
          Crear Nuevo Tema
        </Link>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="topics tabs">
          <Tab 
            label={`Creados (${createdTopics.length})`} 
            icon={<EditIcon />} 
            iconPosition="start"
          />
          <Tab 
            label={`Moderados (${moderatedTopics.length})`} 
            icon={<SupervisorAccountIcon />} 
            iconPosition="start"
          />
          <Tab 
            label={`Invitaciones (${invitations.length})`} 
            icon={<MailIcon />} 
            iconPosition="start"
          />
          <Tab 
            label={`Sugerencias (${suggestions.length})`} 
            icon={<LightbulbIcon />} 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">Cargando...</div>
      )}

      {/* Error State */}
      {currentError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => {
          if (activeTab === 0) setCreatedError(null);
          else if (activeTab === 1) setModeratedError(null);
          else if (activeTab === 2) setInvitationsError(null);
          else setSuggestionsError(null);
        }}>
          {currentError}
        </Alert>
      )}

      {/* Created Topics Tab - cards like TopicList */}
      {activeTab === 0 && !createdLoading && !createdError && (
        <Box>
          <Grid container spacing={3}>
            {createdTopics.map((topic) => {
              const imageUrl = getTopicImageUrl(topic) || `https://picsum.photos/800/400?random=${topic.id}`;
              return (
                <Grid item xs={12} sm={6} md={4} key={topic.id}>
                  <Card>
                    <CardActionArea onClick={() => navigate(`/content/topics/${topic.id}`)}>
                      <CardMedia
                        component="img"
                        height="140"
                        image={imageUrl}
                        alt={topic.title}
                        sx={{
                          objectFit: 'cover',
                          objectPosition: topic.topic_image_focal_x != null && topic.topic_image_focal_y != null
                            ? `${(topic.topic_image_focal_x * 100).toFixed(1)}% ${(topic.topic_image_focal_y * 100).toFixed(1)}%`
                            : '50% 50%',
                        }}
                      />
                      <CardContent>
                        <Typography variant="h6" gutterBottom color="text.primary">
                          {topic.title}
                        </Typography>
                        {topic.description && (
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {topic.description}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {topic.created_at ? new Date(topic.created_at).toLocaleDateString() : ''}
                          </Typography>
                          <Link
                            to={`/content/topics/${topic.id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <EditIcon sx={{ fontSize: 18 }} />
                            <Typography component="span" variant="caption">Editar</Typography>
                          </Link>
                        </Box>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {createdTopics.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>Aún no has creado temas</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Comienza creando tu primer tema para organizar y compartir contenido relacionado.</Typography>
              <Button component={Link} to="/content/create_topic" variant="contained" color="primary">
                Crear Tu Primer Tema
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* Moderated Topics Tab - cards like TopicList */}
      {activeTab === 1 && !moderatedLoading && !moderatedError && (
        <Box>
          <Grid container spacing={3}>
            {moderatedTopics.map((topic) => {
              const imageUrl = getTopicImageUrl(topic) || `https://picsum.photos/800/400?random=${topic.id}`;
              return (
                <Grid item xs={12} sm={6} md={4} key={topic.id}>
                  <Card>
                    <CardActionArea onClick={() => navigate(`/content/topics/${topic.id}`)}>
                      <CardMedia
                        component="img"
                        height="140"
                        image={imageUrl}
                        alt={topic.title}
                        sx={{
                          objectFit: 'cover',
                          objectPosition: topic.topic_image_focal_x != null && topic.topic_image_focal_y != null
                            ? `${(topic.topic_image_focal_x * 100).toFixed(1)}% ${(topic.topic_image_focal_y * 100).toFixed(1)}%`
                            : '50% 50%',
                        }}
                      />
                      <CardContent>
                        <Typography variant="h6" gutterBottom color="text.primary">
                          {topic.title}
                        </Typography>
                        {topic.description && (
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {topic.description}
                          </Typography>
                        )}
                        {topic.created_at && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            {new Date(topic.created_at).toLocaleDateString()}
                          </Typography>
                        )}
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {moderatedTopics.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>Aún no eres moderador de ningún tema</Typography>
              <Typography variant="body2" color="text.secondary">Los temas en los que eres moderador aparecerán aquí una vez que aceptes una invitación.</Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Invitations Tab */}
      {activeTab === 2 && !invitationsLoading && !invitationsError && (
        <div>
          {invitations.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold text-gray-600 mb-4">No tienes invitaciones pendientes</h3>
              <p className="text-gray-500 mb-6">Las invitaciones para ser moderador de temas aparecerán aquí.</p>
            </div>
          ) : (
            <List>
              {invitations.map((invitation) => (
                <ListItem
                  key={invitation.id}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 2,
                    bgcolor: 'background.paper'
                  }}
                >
                  <ListItemText
                    primary={
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {invitation.topic?.title || 'Tema'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Invitado por: {invitation.invited_by?.username || 'Usuario'}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        {invitation.message && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {invitation.message}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {invitation.created_at ? new Date(invitation.created_at).toLocaleDateString() : ''}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => handleAcceptInvitation(invitation)}
                        disabled={processingInvitation[invitation.id] === 'accepting' || processingInvitation[invitation.id] === 'declining'}
                      >
                        Aceptar
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<CancelIcon />}
                        onClick={() => handleDeclineInvitation(invitation)}
                        disabled={processingInvitation[invitation.id] === 'accepting' || processingInvitation[invitation.id] === 'declining'}
                      >
                        Rechazar
                      </Button>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </div>
      )}

      {/* Content Suggestions Tab */}
      {activeTab === 3 && !suggestionsLoading && !suggestionsError && (
        <div>
          {suggestions.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold text-gray-600 mb-4">No tienes sugerencias de contenido</h3>
              <p className="text-gray-500 mb-6">Las sugerencias de contenido que hagas para temas aparecerán aquí.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="p-6 bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {suggestion.content?.original_title || 'Sin título'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Tema: {suggestion.topic?.title || 'Tema desconocido'}
                      </Typography>
                    </Box>
                    {getStatusChip(suggestion.status)}
                  </Box>

                  {suggestion.message && suggestion.message.trim() && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Tu mensaje:</strong> {suggestion.message}
                      </Typography>
                    </Box>
                  )}

                  {suggestion.status === 'REJECTED' && suggestion.rejection_reason && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        <strong>Razón de rechazo:</strong> {suggestion.rejection_reason}
                      </Typography>
                    </Alert>
                  )}

                  {suggestion.is_duplicate && (
                    <Chip 
                      label="Este contenido ya estaba en el tema" 
                      size="small" 
                      color="warning" 
                      sx={{ mb: 1 }}
                    />
                  )}

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Sugerido el {suggestion.created_at ? new Date(suggestion.created_at).toLocaleString() : '-'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button 
                        size="small" 
                        variant="outlined"
                        onClick={() => navigate(`/content/topics/${suggestion.topic?.id}`)}
                      >
                        Ver Tema
                      </Button>
                      <Button 
                        size="small" 
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteSuggestion(suggestion)}
                        disabled={deletingSuggestion[suggestion.id]}
                      >
                        {deletingSuggestion[suggestion.id] ? 'Eliminando...' : 'Eliminar'}
                      </Button>
                    </Box>
                  </Box>

                  {suggestion.reviewed_at && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      Revisado el {new Date(suggestion.reviewed_at).toLocaleString()}
                      {suggestion.reviewed_by && ` por ${suggestion.reviewed_by.username}`}
                    </Typography>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TopicsUser;