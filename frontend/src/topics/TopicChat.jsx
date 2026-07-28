import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Link,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import SendIcon from '@mui/icons-material/Send';
import contentApi from '../api/contentApi';
import { useAuth } from '../context/AuthContext';

/**
 * Session-only RAG chat for a topic (no server-side history persistence).
 */
function TopicChat({ topicId }) {
  const { isAuthenticated } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isAuthenticated) {
    return (
      <Alert severity="info" sx={{ borderRadius: 0 }}>
        Inicia sesión para conversar con las transcripciones de este tema.
      </Alert>
    );
  }

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    setInput('');
    const historyForApi = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const data = await contentApi.topicChat(topicId, {
        message: text,
        history: historyForApi,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer || '',
          sources: data.sources || [],
        },
      ]);
    } catch (err) {
      const detail =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        'No se pudo obtener una respuesta.';
      setError(typeof detail === 'string' ? detail : 'No se pudo obtener una respuesta.');
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
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
        gap: 2,
        minHeight: 360,
        maxHeight: { xs: '70vh', md: 560 },
      }}
    >
      <Typography variant="body2" color="text.secondary">
        Pregunta sobre las transcripciones indexadas de este tema. Las respuestas
        se basan solo en ese material.
      </Typography>

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          px: 2,
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {messages.length === 0 && !loading && (
          <Typography variant="body2" color="text.secondary">
            Ejemplo: «¿Qué argumentos dan sobre el tamaño de los bloques?»
          </Typography>
        )}

        {messages.map((msg, idx) => (
          <Box
            key={`${msg.role}-${idx}`}
            sx={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: { xs: '95%', sm: '85%' },
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 0.5 }}
            >
              {msg.role === 'user' ? 'Tú' : 'Asistente'}
            </Typography>
            <Box
              sx={{
                px: 1.5,
                py: 1.25,
                bgcolor: msg.role === 'user' ? 'action.hover' : 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <Typography variant="body1" component="div">
                {msg.content}
              </Typography>
            </Box>
                    {msg.role === 'assistant' && msg.sources?.length > 0 && (
              <Box sx={{ mt: 1, pl: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Fuentes
                </Typography>
                {msg.sources.map((src) => {
                  const transcriptTo = src.content_id
                    ? `/content/${src.content_id}/transcript?context=topic&topicId=${topicId}`
                    : src.transcript_url;
                  return (
                  <Typography
                    key={`${src.index}-${src.content_id}-${src.chunk_index}`}
                    variant="body2"
                    sx={{ mb: 0.5 }}
                  >
                    [{src.index}]{' '}
                    {transcriptTo ? (
                      <Link
                        component={RouterLink}
                        to={transcriptTo}
                        underline="always"
                      >
                        {src.title || `Contenido ${src.content_id}`}
                      </Link>
                    ) : (
                      src.title || `Fuente ${src.index}`
                    )}
                    {typeof src.score === 'number' && (
                      <Typography component="span" variant="caption" color="text.secondary">
                        {` · score ${src.score.toFixed(2)}`}
                      </Typography>
                    )}
                  </Typography>
                  );
                })}
              </Box>
            )}
          </Box>
        ))}

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Buscando en las transcripciones…
            </Typography>
          </Box>
        )}
        <div ref={bottomRef} />
      </Box>

      {error && (
        <Alert severity="error" sx={{ borderRadius: 0 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder="Escribe tu pregunta…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
          size="small"
        />
        <Button
          variant="contained"
          onClick={send}
          disabled={loading || !input.trim()}
          endIcon={<SendIcon />}
          sx={{ flexShrink: 0, minHeight: 40 }}
        >
          Enviar
        </Button>
      </Box>
    </Box>
  );
}

export default TopicChat;
