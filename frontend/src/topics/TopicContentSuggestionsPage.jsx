import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Link,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/Pending';
import TimelineIcon from '@mui/icons-material/Timeline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import contentApi from '../api/contentApi';
import VoteComponent from '../votes/VoteComponent';
import { useAuth } from '../context/AuthContext';
import { getContentOpenInNewTabUrl } from '../utils/fileUtils';

const TAB_CONTENT = 'content';
const TAB_TIMELINE = 'timeline';

const formatTimelineDate = (value) => {
  if (!value) return null;
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

const getStatusChip = (status) => {
  const statusConfig = {
    PENDING: {
      label: 'Pendiente',
      color: 'warning',
      icon: <PendingIcon fontSize="small" />,
    },
    ACCEPTED: {
      label: 'Aceptada',
      color: 'success',
      icon: <CheckCircleIcon fontSize="small" />,
    },
    REJECTED: {
      label: 'Rechazada',
      color: 'error',
      icon: <CancelIcon fontSize="small" />,
    },
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

const ContentSuggestionCard = ({ suggestion, isAuthenticated }) => {
  const viewUrl = getContentOpenInNewTabUrl(suggestion.content);
  const title = suggestion.content?.original_title || 'Sin titulo';

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            {viewUrl ? (
              <Link
                href={viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="h6"
                gutterBottom
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  textDecoration: 'none',
                  color: 'primary.main',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {title}
                <OpenInNewIcon sx={{ fontSize: 18 }} aria-hidden />
              </Link>
            ) : (
              <Typography variant="h6" gutterBottom>
                {title}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              Sugerido por <strong>{suggestion.suggested_by?.username || 'Usuario desconocido'}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {getStatusChip(suggestion.status)}
            {isAuthenticated && (
              <VoteComponent
                type="content_suggestion"
                ids={{ suggestionId: suggestion.id }}
                initialVoteCount={suggestion.vote_count || 0}
                initialUserVote={suggestion.user_vote || 0}
              />
            )}
          </Box>
        </Box>

        {suggestion.message?.trim() && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <strong>Mensaje para moderadores:</strong> {suggestion.message}
          </Typography>
        )}

        {suggestion.status === 'REJECTED' && suggestion.rejection_reason && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Razon de rechazo:</strong> {suggestion.rejection_reason}
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

        <Typography variant="caption" color="text.secondary">
          Sugerido el {suggestion.created_at ? new Date(suggestion.created_at).toLocaleString() : '-'}
        </Typography>
        {suggestion.reviewed_at && (
          <Typography variant="caption" color="text.secondary" display="block">
            Revisado el {new Date(suggestion.reviewed_at).toLocaleString()}
            {suggestion.reviewed_by && ` por ${suggestion.reviewed_by.username}`}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

const TimelineSuggestionCard = ({ suggestion }) => {
  const startLabel = formatTimelineDate(suggestion.start_date);
  const endLabel = formatTimelineDate(suggestion.end_date);
  const dateLabel = startLabel
    ? (endLabel ? `${startLabel} - ${endLabel}` : startLabel)
    : 'Sin fecha';

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <TimelineIcon fontSize="small" color="primary" />
              <Typography variant="h6">{suggestion.title}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Sugerido por <strong>{suggestion.suggested_by?.username || 'Usuario desconocido'}</strong>
              {' · '}
              {dateLabel}
            </Typography>
          </Box>
          {getStatusChip(suggestion.status)}
        </Box>

        {suggestion.description?.trim() && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
            <strong>Descripcion narrativa:</strong> {suggestion.description}
          </Typography>
        )}

        {suggestion.message?.trim() && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <strong>Mensaje para moderadores:</strong> {suggestion.message}
          </Typography>
        )}

        {(suggestion.contents || []).slice(0, 1).map((item) => {
          const content = item.content;
          const viewUrl = getContentOpenInNewTabUrl(content);
          const contentTitle = content?.original_title || 'Sin titulo';
          if (!viewUrl) {
            return (
              <Typography key={item.id} variant="body2" sx={{ mb: 2 }}>
                {contentTitle}
              </Typography>
            );
          }
          return (
            <Link
              key={item.id}
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="body2"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                mb: 2,
              }}
            >
              {contentTitle}
              <OpenInNewIcon sx={{ fontSize: 16 }} aria-hidden />
            </Link>
          );
        })}

        {suggestion.status === 'REJECTED' && suggestion.rejection_reason && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Razon de rechazo:</strong> {suggestion.rejection_reason}
            </Typography>
          </Alert>
        )}

        {suggestion.is_duplicate && (
          <Chip label="Entrada similar ya existe en la linea de tiempo" size="small" color="warning" sx={{ mb: 1 }} />
        )}

        <Typography variant="caption" color="text.secondary">
          Sugerido el {suggestion.created_at ? new Date(suggestion.created_at).toLocaleString() : '-'}
        </Typography>
        {suggestion.reviewed_at && (
          <Typography variant="caption" color="text.secondary" display="block">
            Revisado el {new Date(suggestion.reviewed_at).toLocaleString()}
            {suggestion.reviewed_by && ` por ${suggestion.reviewed_by.username}`}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

const TopicContentSuggestionsPage = () => {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [contentSuggestions, setContentSuggestions] = useState([]);
  const [timelineSuggestions, setTimelineSuggestions] = useState([]);
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const activeTab = searchParams.get('tab') === TAB_TIMELINE ? TAB_TIMELINE : TAB_CONTENT;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [topicData, contentData, timelineData] = await Promise.all([
        contentApi.getTopicDetails(topicId, { include_contents: false }),
        contentApi.getTopicContentSuggestions(topicId, {}),
        contentApi.getTopicTimelineEntrySuggestions(topicId, {}),
      ]);
      setTopic(topicData);
      setContentSuggestions(Array.isArray(contentData) ? contentData : []);
      setTimelineSuggestions(Array.isArray(timelineData) ? timelineData : []);
      setError(null);
    } catch (err) {
      setError('Error al cargar las sugerencias');
      console.error('Error fetching suggestions:', err);
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTabChange = (_, value) => {
    setSearchParams(value === TAB_CONTENT ? {} : { tab: value }, { replace: true });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/content/topics/${topicId}`)}>
          Volver al Tema
        </Button>
      </Box>
    );
  }

  const activeList = activeTab === TAB_TIMELINE ? timelineSuggestions : contentSuggestions;
  const emptyMessage = activeTab === TAB_TIMELINE
    ? 'No hay sugerencias de linea de tiempo para este tema.'
    : 'No hay sugerencias de contenido para este tema.';

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/content/topics/${topicId}`)}
          sx={{ mb: 2 }}
        >
          Volver al Tema
        </Button>
        <Typography variant="h4" gutterBottom>
          Sugerencias del tema
        </Typography>
        {topic && (
          <Typography variant="body1" color="text.secondary">
            Tema: {topic.title}
          </Typography>
        )}
      </Box>

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          value={TAB_CONTENT}
          label={contentSuggestions.length > 0 ? `Contenido (${contentSuggestions.length})` : 'Contenido'}
        />
        <Tab
          value={TAB_TIMELINE}
          label={timelineSuggestions.length > 0 ? `Linea de tiempo (${timelineSuggestions.length})` : 'Linea de tiempo'}
        />
      </Tabs>

      {activeList.length === 0 ? (
        <Alert severity="info">{emptyMessage}</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {activeTab === TAB_CONTENT
            ? contentSuggestions.map((suggestion) => (
              <ContentSuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                isAuthenticated={isAuthenticated}
              />
            ))
            : timelineSuggestions.map((suggestion) => (
              <TimelineSuggestionCard key={suggestion.id} suggestion={suggestion} />
            ))}
        </Box>
      )}
    </Box>
  );
};

export default TopicContentSuggestionsPage;
