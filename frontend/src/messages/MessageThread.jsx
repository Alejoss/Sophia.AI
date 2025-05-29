import React, { useEffect, useState, useContext, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { fetchOrCreateThread, fetchMessages, sendMessage } from '../api/messagesApi';
import { Box, Typography, Paper, CircularProgress, TextField, Button, List, ListItem, ListItemText } from '@mui/material';

const MessageThread = () => {
  const { userId } = useParams();
  const { authState } = useContext(AuthContext);
  const currentUser = authState.user;
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const loadThreadAndMessages = async () => {
      setLoading(true);
      try {
        const threadRes = await fetchOrCreateThread(userId);
        setThread(threadRes.data);
        const threadId = threadRes.data.id;
        const messagesRes = await fetchMessages(threadId);
        setMessages(messagesRes.data);
        setError(null);
      } catch (err) {
        setError('Failed to load messages.');
      } finally {
        setLoading(false);
      }
    };
    loadThreadAndMessages();
  }, [userId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !thread) return;
    setSending(true);
    try {
      await sendMessage(thread.id, newMessage);
      const messagesRes = await fetchMessages(thread.id);
      setMessages(messagesRes.data);
      setNewMessage('');
    } catch (err) {
      setError('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>;
  if (error) return <Box sx={{ p: 3 }}><Typography color="error">{error}</Typography></Box>;
  if (!thread) return <Box sx={{ p: 3 }}><Typography>No thread found.</Typography></Box>;

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
      <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h5" gutterBottom>
          Conversation with User #{userId}
        </Typography>
        <List sx={{ maxHeight: 400, overflowY: 'auto', mb: 2 }}>
          {messages.length === 0 && (
            <ListItem><ListItemText primary="No messages yet." /></ListItem>
          )}
          {messages.map(msg => (
            <ListItem key={msg.id} alignItems={msg.sender.id === currentUser.id ? 'right' : 'left'}>
              <ListItemText
                primary={msg.text}
                secondary={
                  <>
                    <Typography component="span" variant="caption" color="text.secondary">
                      {msg.sender.username} &bull; {new Date(msg.timestamp).toLocaleString()}
                    </Typography>
                  </>
                }
                sx={{ textAlign: msg.sender.id === currentUser.id ? 'right' : 'left' }}
              />
            </ListItem>
          ))}
          <div ref={messagesEndRef} />
        </List>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            placeholder="Type your message..."
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSendMessage(); }}
            disabled={sending}
          />
          <Button variant="contained" color="primary" onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
            Send
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default MessageThread; 