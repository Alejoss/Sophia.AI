import React, { useEffect, useState, useContext, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { AuthContext } from '../context/AuthContext';
import { fetchOrCreateThread, fetchMessages, sendMessage } from '../api/messagesApi';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Alert,
} from '@mui/material';
import { applyApiErrorsToForm } from '../utils/apiFormErrors.js';

const messageSchema = yup.object({
  text: yup
    .string()
    .trim()
    .required('Escribe un mensaje antes de enviar.'),
});

const MessageThread = () => {
  const { userId } = useParams();
  const { authState } = useContext(AuthContext);
  const currentUser = authState.user;
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generalError, setGeneralError] = useState('');
  const messagesEndRef = useRef(null);

  const {
    register,
    handleSubmit,
    reset,
    setError: setFormError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(messageSchema),
    defaultValues: { text: '' },
  });

  const getOtherUser = () => {
    if (!thread || !currentUser) return null;
    return thread.participant1.id === currentUser.id ? thread.participant2 : thread.participant1;
  };

  useEffect(() => {
    const loadThreadAndMessages = async () => {
      setLoading(true);
      try {
        const threadRes = await fetchOrCreateThread(userId);
        if (!threadRes.data) {
          throw new Error('Error al crear o obtener el hilo');
        }
        setThread(threadRes.data);
        const threadId = threadRes.data.id;
        const messagesRes = await fetchMessages(threadId);
        const messagesData = Array.isArray(messagesRes.data) ? messagesRes.data : [];
        setMessages(messagesData);
        setError(null);
      } catch (err) {
        console.error('Error loading messages:', err);
        setError('Error al cargar los mensajes.');
      } finally {
        setLoading(false);
      }
    };
    loadThreadAndMessages();
  }, [userId]);

  const onSubmit = async ({ text }) => {
    if (!thread) return;

    setGeneralError('');

    try {
      await sendMessage(thread.id, text);
      const messagesRes = await fetchMessages(thread.id);
      const messagesData = Array.isArray(messagesRes.data) ? messagesRes.data : [];
      setMessages(messagesData);
      reset({ text: '' });
    } catch (err) {
      console.error('Error sending message:', err);
      const { generalError: parsed } = applyApiErrorsToForm(
        err,
        setFormError,
        'Error al enviar el mensaje.',
        { message: 'text', content: 'text' },
      );
      if (parsed) {
        setGeneralError(parsed);
      }
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>;
  if (error) return <Box sx={{ p: 3 }}><Typography color="error">{error}</Typography></Box>;
  if (!thread) return <Box sx={{ p: 3 }}><Typography>No se encontró el hilo.</Typography></Box>;

  const otherUser = getOtherUser();

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
      <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h5" gutterBottom>
          Conversación con{' '}
          <Link
            to={`/profiles/user_profile/${otherUser?.id}`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            {otherUser ? otherUser.username : 'Usuario'}
          </Link>
        </Typography>
        <List sx={{ maxHeight: 400, overflowY: 'auto', mb: 2 }}>
          {(!messages || messages.length === 0) && (
            <ListItem><ListItemText primary="Aún no hay mensajes." /></ListItem>
          )}
          {messages && messages.map(msg => (
            <ListItem
              key={msg.id}
              sx={{
                justifyContent: msg.sender.id === currentUser.id ? 'flex-end' : 'flex-start',
                mb: 1
              }}
            >
              <Box
                sx={{
                  maxWidth: '70%',
                  backgroundColor: msg.sender.id === currentUser.id ? 'primary.main' : 'grey.200',
                  color: msg.sender.id === currentUser.id ? 'white' : 'text.primary',
                  borderRadius: 1,
                  p: 1.5,
                  px: 2
                }}
              >
                <Typography variant="body1">{msg.text}</Typography>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: msg.sender.id === currentUser.id ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                    mt: 0.5
                  }}
                >
                  {msg.sender.username} &bull; {new Date(msg.timestamp).toLocaleString('es-ES')}
                </Typography>
              </Box>
            </ListItem>
          ))}
          <div ref={messagesEndRef} />
        </List>
        <Box
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}
        >
          {generalError && (
            <Alert severity="error">{generalError}</Alert>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="Escriba su mensaje..."
              error={!!errors.text}
              helperText={errors.text?.message}
              disabled={isSubmitting}
              {...register('text')}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default MessageThread;
