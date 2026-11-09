import React, { useEffect, useLayoutEffect, useState, useContext, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDateLocales } from '../hooks/useDateLocales';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { AuthContext } from '../context/AuthContext';
import { fetchOrCreateThread, fetchMessages, sendMessage } from '../api/messagesApi';
import {
  Box,
  Typography,
  CircularProgress,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Alert,
  IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { applyApiErrorsToForm } from '../utils/apiFormErrors.js';

const messageSchema = yup.object({
  text: yup
    .string()
    .trim()
    .required(() => i18n.t('messages:validation.writeBeforeSend')),
});

const MessageThread = () => {
  const { t } = useTranslation('messages');
  const { intl } = useDateLocales();
  const { userId } = useParams();
  const navigate = useNavigate();
  const { authState } = useContext(AuthContext);
  const currentUser = authState.user;
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generalError, setGeneralError] = useState('');
  const scrollerRef = useRef(null);
  const stickToBottomRef = useRef(true);

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
    stickToBottomRef.current = true;
    const loadThreadAndMessages = async () => {
      setLoading(true);
      try {
        const threadRes = await fetchOrCreateThread(userId);
        if (!threadRes.data) {
          throw new Error(t('thread.createFailed'));
        }
        setThread(threadRes.data);
        const threadId = threadRes.data.id;
        const messagesRes = await fetchMessages(threadId);
        const messagesData = Array.isArray(messagesRes.data) ? messagesRes.data : [];
        setMessages(messagesData);
        setError(null);
      } catch (err) {
        console.error('Error loading messages:', err);
        setError(t('thread.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    loadThreadAndMessages();
  }, [userId, t]);

  const onSubmit = async ({ text }) => {
    if (!thread) return;

    stickToBottomRef.current = true;
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
        t('thread.sendFailed'),
        { message: 'text', content: 'text' },
      );
      if (parsed) {
        setGeneralError(parsed);
      }
    }
  };

  const rememberScrollPosition = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  };

  // Scroll only the message log. scrollIntoView also moves the document,
  // so the page and the thread end up at two different "tops".
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (loading) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, p: 3 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }
  if (!thread) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, p: 3 }}>
        <Typography>{t('thread.notFound')}</Typography>
      </Box>
    );
  }

  const otherUser = getOtherUser();

  return (
    <Box sx={{
      flex: 1,
      minHeight: 0,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <Box sx={{
        flexShrink: 0,
        px: 2,
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        bgcolor: 'background.default',
        position: 'relative',
        zIndex: 1,
      }}>
        <IconButton
          onClick={() => navigate('/messages')}
          aria-label={t('thread.back')}
          sx={{ display: { md: 'none' } }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, minWidth: 0 }}>
          {t('thread.withUser')}{' '}
          <Link
            to={`/profiles/user_profile/${otherUser?.id}`}
            style={{ color: 'inherit' }}
          >
            {otherUser ? otherUser.username : t('thread.unknownUser')}
          </Link>
        </Typography>
      </Box>

      <Box
        sx={{
          // The log clips on its own edge. Without this gutter that edge
          // is the title bar, so the top of a bubble is hidden behind it.
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          px: 2,
          py: 2,
        }}
      >
      <Box
        ref={scrollerRef}
        role="log"
        aria-label={t('thread.logLabel')}
        onScroll={rememberScrollPosition}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
        }}
      >
        <List>
          {(!messages || messages.length === 0) && (
            <ListItem><ListItemText primary={t('thread.empty')} /></ListItem>
          )}
          {messages && messages.map(msg => {
            const isOwn = msg.sender.id === currentUser.id;
            return (
              <ListItem
                key={msg.id}
                sx={{
                  justifyContent: isOwn ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-start',
                  mb: 1,
                }}
              >
                <Box
                  sx={(theme) => ({
                    maxWidth: '70%',
                    // grey.200 is always light; in dark mode text.primary is light too —
                    // use a dark surface so received bubbles stay readable.
                    backgroundColor: isOwn
                      ? theme.palette.primary.main
                      : theme.palette.mode === 'dark'
                        ? theme.palette.grey[800]
                        : theme.palette.grey[200],
                    color: isOwn
                      ? theme.palette.primary.contrastText
                      : theme.palette.text.primary,
                    borderRadius: 1,
                    p: 1.5,
                    px: 2,
                  })}
                >
                  <Typography variant="body1" sx={{ color: 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {msg.text}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: isOwn ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                      mt: 0.5
                    }}
                  >
                    {msg.sender.username} &bull; {new Date(msg.timestamp).toLocaleString(intl)}
                  </Typography>
                </Box>
              </ListItem>
            );
          })}
        </List>
      </Box>
      </Box>

      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        sx={{
          flexShrink: 0,
          display: 'flex',
          gap: 1,
          flexDirection: 'column',
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {generalError && (
          <Alert severity="error">{generalError}</Alert>
        )}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            placeholder={t('thread.placeholder')}
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
            sx={{ flexShrink: 0 }}
          >
            {isSubmitting ? t('thread.sending') : t('thread.send')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default MessageThread;
