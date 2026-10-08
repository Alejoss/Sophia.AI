import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Container,
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
  Alert,
  CircularProgress,
  Stack,
  Paper,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import MailIcon from '@mui/icons-material/Mail';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/Pending';
import DeleteIcon from '@mui/icons-material/Delete';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';
import { MEDIA_BASE_URL } from '../api/config';
import { useDateLocales } from '../hooks/useDateLocales';

const TopicsUser = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('topics');
  const { intl } = useDateLocales();
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
  const [timelineSuggestions, setTimelineSuggestions] = useState([]);

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
      setCreatedError(t('user.loadCreatedError'));
    } finally {
      setCreatedLoading(false);
    }

    // Fetch moderated topics
    try {
      const moderated = await contentApi.getUserTopics('moderated');
      setModeratedTopics(Array.isArray(moderated) ? moderated : []);
    } catch (err) {
      console.error('Error fetching moderated topics:', err);
      setModeratedError(t('user.loadModeratedError'));
    } finally {
      setModeratedLoading(false);
    }

    // Fetch invitations
    try {
      const inv = await contentApi.getUserTopicInvitations('PENDING');
      setInvitations(Array.isArray(inv) ? inv : []);
    } catch (err) {
      console.error('Error fetching invitations:', err);
      setInvitationsError(t('user.loadInvitationsError'));
    } finally {
      setInvitationsLoading(false);
    }

    // Fetch content suggestions
    try {
      const [contentSugg, timelineSugg] = await Promise.all([
        contentApi.getUserContentSuggestions({}),
        contentApi.getUserTimelineEntrySuggestions({}),
      ]);
      setSuggestions(Array.isArray(contentSugg) ? contentSugg : []);
      setTimelineSuggestions(Array.isArray(timelineSugg) ? timelineSugg : []);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setSuggestionsError(t('suggestion.loadMineError'));
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [t]);

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
      setInvitationsError(err.response?.data?.error || t('user.acceptInvitationError'));
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
      setInvitationsError(err.response?.data?.error || t('user.rejectInvitationError'));
    } finally {
      setProcessingInvitation(prev => {
        const newState = { ...prev };
        delete newState[invitationId];
        return newState;
      });
    }
  };

  const handleDeleteTimelineSuggestion = async (suggestion) => {
    const topicId = suggestion.topic?.id;
    if (!topicId) return;
    const key = `timeline-${suggestion.id}`;
    setDeletingSuggestion((prev) => ({ ...prev, [key]: true }));
    try {
      await contentApi.deleteTopicTimelineEntrySuggestion(topicId, suggestion.id);
      setTimelineSuggestions((prev) => prev.filter((item) => item.id !== suggestion.id));
    } catch (err) {
      console.error('Error deleting timeline suggestion:', err);
      setSuggestionsError(t('user.deleteTimelineError'));
    } finally {
      setDeletingSuggestion((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleDeleteSuggestion = async (suggestion) => {
    const suggestionId = suggestion.id;
    const topicId = suggestion.topic?.id;
    
    if (!topicId) {
      console.error('Topic ID not found in suggestion');
      return;
    }

    if (!window.confirm(t('user.deleteConfirm'))) {
      return;
    }

    setDeletingSuggestion(prev => ({ ...prev, [suggestionId]: true }));

    try {
      await contentApi.deleteContentSuggestion(topicId, suggestionId);
      // Remove suggestion from list
      setSuggestions(prev => prev.filter(sugg => sugg.id !== suggestionId));
    } catch (err) {
      console.error('Error deleting suggestion:', err);
      setSuggestionsError(err.response?.data?.error || t('user.deleteSuggestionError'));
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
        label: t('common.pending'), 
        color: 'warning',
        icon: <PendingIcon fontSize="small" />
      },
      ACCEPTED: { 
        label: t('suggestion.statusAccepted'), 
        color: 'success',
        icon: <CheckCircleIcon fontSize="small" />
      },
      REJECTED: { 
        label: t('suggestion.statusRejected'), 
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
    const image = topic.topic_image_thumbnail || topic.topic_image;
    if (image) {
      return image.startsWith('http')
        ? image
        : `${MEDIA_BASE_URL}${image}`;
    }
    return null;
  };

  const isLoading = createdLoading || moderatedLoading || invitationsLoading || suggestionsLoading;
  const currentError = activeTab === 0 ? createdError : 
                       activeTab === 1 ? moderatedError : 
                       activeTab === 2 ? invitationsError : 
                       suggestionsError;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
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
          {t('list.title')}
        </Typography>
        <Button
          component={Link}
          to="/content/create_topic"
          variant="contained"
          color="primary"
        >
          {t('user.requestCreation')}
        </Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="topics tabs">
          <Tab 
            label={t('user.createdCount', { count: createdTopics.length })} 
            icon={<EditIcon />} 
            iconPosition="start"
          />
          <Tab 
            label={t('user.moderatedCount', { count: moderatedTopics.length })} 
            icon={<SupervisorAccountIcon />} 
            iconPosition="start"
          />
          <Tab 
            label={t('user.invitationsCount', { count: invitations.length })} 
            icon={<MailIcon />} 
            iconPosition="start"
          />
          <Tab 
            label={t('edit.suggestionsCount', { count: suggestions.length })} 
            icon={<LightbulbIcon />} 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Loading State */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
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
                            {topic.created_at ? new Date(topic.created_at).toLocaleDateString(intl) : ''}
                          </Typography>
                          <Link
                            to={`/content/topics/${topic.id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <EditIcon sx={{ fontSize: 18 }} />
                            <Typography component="span" variant="caption">{t('common.edit')}</Typography>
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
              <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>{t('user.emptyCreatedTitle')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{t('user.emptyCreatedHelp')}</Typography>
              <Button component={Link} to="/content/create_topic" variant="contained" color="primary">
                {t('user.requestFirst')}
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
                            {new Date(topic.created_at).toLocaleDateString(intl)}
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
              <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>{t('user.emptyModeratedTitle')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('user.emptyModeratedHelp')}</Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Invitations Tab */}
      {activeTab === 2 && !invitationsLoading && !invitationsError && (
        <Box>
          {invitations.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1.5 }}>
                {t('user.emptyInvitationsTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('user.emptyInvitationsHelp')}
              </Typography>
            </Box>
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
                          {invitation.topic?.title || t('user.topicFallback')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t('user.invitedBy', { user: invitation.invited_by?.username || t('moderators.userFallback') })}
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
                          {invitation.created_at ? new Date(invitation.created_at).toLocaleDateString(intl) : ''}
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
                        {t('common.accept')}
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<CancelIcon />}
                        onClick={() => handleDeclineInvitation(invitation)}
                        disabled={processingInvitation[invitation.id] === 'accepting' || processingInvitation[invitation.id] === 'declining'}
                      >
                        {t('common.reject')}
                      </Button>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}

      {/* Content Suggestions Tab */}
      {activeTab === 3 && !suggestionsLoading && !suggestionsError && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
            {t('user.contentSuggestionsTitle')}
          </Typography>
          {suggestions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              {t('user.emptyContentSuggestions')}
            </Typography>
          ) : (
            <Stack spacing={2} sx={{ mb: 4 }}>
              {suggestions.map((suggestion) => (
                <Paper
                  key={suggestion.id}
                  variant="outlined"
                  sx={{
                    p: 3,
                    transition: 'box-shadow 0.2s ease',
                    '&:hover': { boxShadow: 2 },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {suggestion.content?.original_title || t('common.untitled')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('suggestion.topicLine', { title: suggestion.topic?.title || t('suggestion.unknownTopic') })}
                      </Typography>
                    </Box>
                    {getStatusChip(suggestion.status)}
                  </Box>

                  {suggestion.message && suggestion.message.trim() && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>{t('suggestion.yourMessage')}</strong> {suggestion.message}
                      </Typography>
                    </Box>
                  )}

                  {suggestion.status === 'REJECTED' && suggestion.rejection_reason && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        <strong>{t('user.rejectionReason')}</strong> {suggestion.rejection_reason}
                      </Typography>
                    </Alert>
                  )}

                  {suggestion.is_duplicate && (
                    <Chip 
                      label={t('common.alreadyInTopic')} 
                      size="small" 
                      color="warning" 
                      sx={{ mb: 1 }}
                    />
                  )}

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('common.suggestedOn')} {suggestion.created_at ? new Date(suggestion.created_at).toLocaleString(intl) : '-'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button 
                        size="small" 
                        variant="outlined"
                        onClick={() => navigate(`/content/topics/${suggestion.topic?.id}`)}
                      >
                        {t('user.viewTopicCapital')}
                      </Button>
                      <Button 
                        size="small" 
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteSuggestion(suggestion)}
                        disabled={deletingSuggestion[suggestion.id]}
                      >
                        {deletingSuggestion[suggestion.id] ? t('edit.deleting') : t('common.delete')}
                      </Button>
                    </Box>
                  </Box>

                  {suggestion.reviewed_at && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      {t('common.reviewedOn')} {new Date(suggestion.reviewed_at).toLocaleString(intl)}
                      {suggestion.reviewed_by && t('suggestion.byUser', { user: suggestion.reviewed_by.username })}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Stack>
          )}

          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
            {t('user.timelineSuggestionsTitle')}
          </Typography>
          {timelineSuggestions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('user.emptyTimelineSuggestions')}
            </Typography>
          ) : (
            <Stack spacing={2}>
              {timelineSuggestions.map((suggestion) => (
                <Paper key={`timeline-${suggestion.id}`} variant="outlined" sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {suggestion.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('suggestion.topicLine', { title: suggestion.topic?.title || t('suggestion.unknownTopic') })}
                      </Typography>
                    </Box>
                    {getStatusChip(suggestion.status)}
                  </Box>
                  {suggestion.message && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>{t('suggestion.yourMessage')}</strong> {suggestion.message}
                    </Typography>
                  )}
                  {(suggestion.contents || []).length > 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {t('user.proposedContents', { count: (suggestion.contents || []).length })}
                    </Typography>
                  )}
                  {suggestion.status === 'REJECTED' && suggestion.rejection_reason && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      <strong>{t('suggestion.rejectionPlainColon')}</strong> {suggestion.rejection_reason}
                    </Alert>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('common.suggestedOn')} {suggestion.created_at ? new Date(suggestion.created_at).toLocaleString(intl) : '-'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate(`/content/topics/${suggestion.topic?.id}?tab=timeline`)}
                      >
                        {t('edit.viewTopic')}
                      </Button>
                      {suggestion.status === 'PENDING' && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleDeleteTimelineSuggestion(suggestion)}
                          disabled={deletingSuggestion[`timeline-${suggestion.id}`]}
                        >
                          {t('common.delete')}
                        </Button>
                      )}
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Container>
  );
};

export default TopicsUser;