import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Link,
  CircularProgress,
  Alert,
  Divider,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import contentApi from '../api/contentApi';
import { useAuth } from '../context/AuthContext';
import { getTopicContentPath } from '../utils/urlUtils';

function formatQueryDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function mediaTypeLabel(mediaType) {
  if (mediaType === 'AUDIO') return 'Audio';
  if (mediaType === 'VIDEO') return 'Video';
  if (mediaType === 'TEXT') return 'Texto';
  return mediaType || 'Archivo';
}

function SourcesList({ sources, topicId }) {
  if (!sources?.length) return null;
  return (
    <Box sx={{ mt: 1.5, px: 0.5, pb: 1 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 1 }}
      >
        Fuentes
      </Typography>
      <Box
        component="ul"
        sx={{
          m: 0,
          pl: 2.25,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.75,
        }}
      >
        {sources.map((src) => {
          let sourceTo = null;
          if (src.content_id) {
            if (src.media_type === 'TEXT') {
              sourceTo = topicId
                ? getTopicContentPath(src.content_id, topicId)
                : `/content/${src.content_id}/library`;
            } else {
              sourceTo = `/content/${src.content_id}/transcript?context=topic${
                topicId ? `&topicId=${topicId}` : ''
              }`;
            }
          } else {
            sourceTo = src.url || src.transcript_url;
          }
          return (
            <Box
              component="li"
              key={`${src.index}-${src.content_id}-${src.chunk_index}`}
            >
              <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                [{src.index}]{' '}
                {sourceTo ? (
                  <Link component={RouterLink} to={sourceTo} underline="hover">
                    {src.title || `Contenido ${src.content_id}`}
                  </Link>
                ) : (
                  src.title || `Fuente ${src.index}`
                )}
                {typeof src.score === 'number' && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                  >
                    {` · score ${src.score.toFixed(2)}`}
                  </Typography>
                )}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function SelectedTranscriptsSummary({ selectedContentIds, sourceById, topicId }) {
  if (!selectedContentIds?.length) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, px: 0.5 }}>
        Archivos consultados: todos los indexados del tema
      </Typography>
    );
  }

  return (
    <Box sx={{ mt: 1.5, px: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
        Archivos seleccionados ({selectedContentIds.length})
      </Typography>
      <Box
        component="ul"
        sx={{
          m: 0,
          pl: 2.25,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
        }}
      >
        {selectedContentIds.map((id) => {
          const src = sourceById?.[id];
          const title = src?.title || `Contenido ${id}`;
          const href = `/content/${id}/transcript?context=topic${
            topicId ? `&topicId=${topicId}` : ''
          }`;
          return (
            <Box component="li" key={id}>
              <Typography variant="body2">
                <Link component={RouterLink} to={href} underline="hover">
                  {title}
                </Link>
                {src?.media_type ? (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {` · ${mediaTypeLabel(src.media_type)}`}
                  </Typography>
                ) : null}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function ConsultationView({ query, topicId, sourceById }) {
  if (!query) return null;
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        px: { xs: 1.5, sm: 2.5 },
        pt: 2.5,
        pb: 3,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
        Tu pregunta · {formatQueryDate(query.created_at)}
      </Typography>
      <Box
        sx={{
          px: 2,
          py: 1.75,
          mb: 2.5,
          bgcolor: 'action.hover',
          border: '1px solid',
          borderColor: 'divider',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        <Typography variant="body1" sx={{ lineHeight: 1.65 }}>
          {query.question}
        </Typography>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
        Respuesta
      </Typography>
      <Box
        sx={{
          px: 2,
          py: 1.75,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        <Typography variant="body1" component="div" sx={{ lineHeight: 1.65 }}>
          {query.answer}
        </Typography>
      </Box>
      <SourcesList sources={query.sources} topicId={topicId} />
      <SelectedTranscriptsSummary
        selectedContentIds={query.selected_content_ids}
        sourceById={sourceById}
        topicId={topicId}
      />
      {(typeof query.used_chunk_count === 'number' ||
        typeof query.retrieved_chunk_count === 'number') && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 1.5, px: 0.5 }}
        >
          Fragmentos usados: {query.used_chunk_count ?? 0}
          {typeof query.retrieved_chunk_count === 'number'
            ? ` / recuperados: ${query.retrieved_chunk_count}`
            : ''}
        </Typography>
      )}
    </Box>
  );
}

function TranscriptChecklist({
  sources,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
  disabled,
  loading,
}) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Cargando contenidos indexados…
        </Typography>
      </Box>
    );
  }

  if (!sources.length) {
    return (
      <Alert severity="warning" sx={{ borderRadius: 0 }}>
        No hay contenidos indexados en este tema todavía.
      </Alert>
    );
  }

  const allSelected = selectedIds.length === sources.length;

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
          mb: 1,
        }}
      >
        <Typography variant="subtitle2">
          Contenidos a consultar ({selectedIds.length}/{sources.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" onClick={onSelectAll} disabled={disabled || allSelected}>
            Todas
          </Button>
          <Button size="small" onClick={onClear} disabled={disabled || selectedIds.length === 0}>
            Ninguna
          </Button>
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Marca los archivos cuyos contenidos quieres usar en esta consulta.
      </Typography>
      <FormGroup
        sx={{
          maxHeight: 220,
          overflowY: 'auto',
          border: '1px solid',
          borderColor: 'divider',
          px: 1.5,
          py: 0.5,
        }}
      >
        {sources.map((src) => {
          const checked = selectedIds.includes(src.content_id);
          const label = (
            <Box sx={{ py: 0.25 }}>
              <Typography variant="body2" sx={{ fontWeight: checked ? 600 : 400 }}>
                {src.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {mediaTypeLabel(src.media_type)}
                {src.original_author ? ` · ${src.original_author}` : ''}
                {typeof src.chunk_count === 'number' ? ` · ${src.chunk_count} fragmentos` : ''}
              </Typography>
            </Box>
          );
          return (
            <FormControlLabel
              key={src.content_id}
              control={
                <Checkbox
                  checked={checked}
                  onChange={() => onToggle(src.content_id)}
                  disabled={disabled}
                  size="small"
                />
              }
              label={label}
              sx={{ alignItems: 'flex-start', mr: 0, py: 0.25 }}
            />
          );
        })}
      </FormGroup>
    </Box>
  );
}

/**
 * Independent topic consultations (one question → one answer), with history.
 */
function TopicChat({ topicId }) {
  const { isAuthenticated } = useAuth();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeQuery, setActiveQuery] = useState(null);
  const [composing, setComposing] = useState(true);
  const [sources, setSources] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  const sourceById = useMemo(() => {
    const map = {};
    sources.forEach((src) => {
      map[src.content_id] = src;
    });
    return map;
  }, [sources]);

  const loadHistory = useCallback(async () => {
    if (!isAuthenticated || !topicId) return;
    setHistoryLoading(true);
    try {
      const data = await contentApi.listTopicChatQueries(topicId);
      setHistory(data.results || []);
    } catch {
      // Non-fatal: form still works.
    } finally {
      setHistoryLoading(false);
    }
  }, [isAuthenticated, topicId]);

  const loadSources = useCallback(async () => {
    if (!isAuthenticated || !topicId) return;
    setSourcesLoading(true);
    try {
      const data = await contentApi.listTopicChatSources(topicId);
      const rows = data.results || [];
      setSources(rows);
      setSelectedIds(rows.map((row) => row.content_id));
    } catch {
      setSources([]);
      setSelectedIds([]);
    } finally {
      setSourcesLoading(false);
    }
  }, [isAuthenticated, topicId]);

  useEffect(() => {
    loadHistory();
    loadSources();
  }, [loadHistory, loadSources]);

  if (!isAuthenticated) {
    return (
      <Alert severity="info" sx={{ borderRadius: 0, mb: 4 }}>
        Inicia sesión para consultar los contenidos de este tema.
      </Alert>
    );
  }

  const startNewConsultation = () => {
    setActiveQuery(null);
    setComposing(true);
    setError(null);
    setInput('');
    setSelectedIds(sources.map((row) => row.content_id));
  };

  const toggleSource = (contentId) => {
    setSelectedIds((prev) =>
      prev.includes(contentId)
        ? prev.filter((id) => id !== contentId)
        : [...prev, contentId]
    );
  };

  const openConsultation = async (id) => {
    setError(null);
    setLoading(true);
    try {
      const data = await contentApi.getTopicChatQuery(topicId, id);
      setActiveQuery(data);
      setComposing(false);
      setInput('');
    } catch (err) {
      const detail =
        err?.response?.data?.error ||
        err?.message ||
        'No se pudo cargar la consulta.';
      setError(typeof detail === 'string' ? detail : 'No se pudo cargar la consulta.');
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (selectedIds.length === 0) {
      setError('Selecciona al menos un contenido para consultar.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const data = await contentApi.topicChat(topicId, {
        message: text,
        contentIds: selectedIds,
      });
      setActiveQuery(data);
      setComposing(false);
      setInput('');
      setHistory((prev) => {
        const preview =
          text.length <= 120 ? text : `${text.slice(0, 117)}…`;
        const row = {
          id: data.id,
          topic_id: data.topic_id,
          question_preview: preview,
          selected_content_ids: data.selected_content_ids || selectedIds,
          created_at: data.created_at,
        };
        return [row, ...prev.filter((item) => item.id !== data.id)];
      });
    } catch (err) {
      const apiError = err?.response?.data?.error || err?.response?.data?.detail;
      const status = err?.response?.status;
      let detail = apiError;
      if (typeof detail !== 'string' || !detail.trim()) {
        if (status >= 500) {
          detail = 'No se pudo completar la consulta. Inténtalo de nuevo en unos segundos.';
        } else {
          detail = err?.message || 'No se pudo obtener una respuesta.';
        }
      }
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
        mb: { xs: 4, md: 6 },
        pb: 1,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        Cada consulta es independiente: eliges qué contenidos indexados
        usar, se responde solo con esos archivos y se guarda en tu historial.
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={startNewConsultation}
          disabled={composing}
        >
          Nueva consulta
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ borderRadius: 0 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {composing ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            px: { xs: 1.5, sm: 2.5 },
            py: 2.5,
          }}
        >
          <Typography variant="subtitle2">Nueva consulta</Typography>
          <TranscriptChecklist
            sources={sources}
            selectedIds={selectedIds}
            onToggle={toggleSource}
            onSelectAll={() => setSelectedIds(sources.map((row) => row.content_id))}
            onClear={() => setSelectedIds([])}
            disabled={loading}
            loading={sourcesLoading}
          />
          <TextField
            fullWidth
            multiline
            minRows={3}
            maxRows={8}
            placeholder="Escribe tu pregunta…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={send}
              disabled={loading || !input.trim() || selectedIds.length === 0}
              endIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            >
              Consultar
            </Button>
          </Box>
        </Box>
      ) : (
        <ConsultationView
          query={activeQuery}
          topicId={topicId}
          sourceById={sourceById}
        />
      )}

      <Divider />

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Tus consultas en este tema
        </Typography>
        {historyLoading && history.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Cargando historial…
            </Typography>
          </Box>
        ) : history.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Aún no has hecho consultas en este tema.
          </Typography>
        ) : (
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            {history.map((item) => {
              const selected = activeQuery?.id === item.id && !composing;
              const selectedCount = Array.isArray(item.selected_content_ids)
                ? item.selected_content_ids.length
                : 0;
              return (
                <Box
                  key={item.id}
                  component="button"
                  type="button"
                  onClick={() => openConsultation(item.id)}
                  disabled={loading}
                  sx={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: selected ? 'action.selected' : 'transparent',
                    px: 2,
                    py: 1.75,
                    cursor: 'pointer',
                    '&:last-child': { borderBottom: 'none' },
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: selected ? 600 : 400 }}>
                    {item.question_preview}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatQueryDate(item.created_at)}
                    {selectedCount > 0
                      ? ` · ${selectedCount} archivo${selectedCount === 1 ? '' : 's'}`
                      : ' · todos los archivos'}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default TopicChat;
