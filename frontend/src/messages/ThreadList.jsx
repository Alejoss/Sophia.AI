import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { fetchThreads } from '../api/messagesApi';
import { 
    Box, 
    List, 
    ListItem, 
    ListItemText, 
    ListItemAvatar, 
    Avatar, 
    Typography, 
    Paper, 
    CircularProgress,
    Divider
} from '@mui/material';

const ThreadList = () => {
    const [threads, setThreads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { authState } = useContext(AuthContext);
    const currentUser = authState.user;
    const navigate = useNavigate();

    useEffect(() => {
        const loadThreads = async () => {
            try {
                const response = await fetchThreads();
                setThreads(response.data);
                setError(null);
            } catch (err) {
                setError('Failed to load conversations.');
            } finally {
                setLoading(false);
            }
        };
        loadThreads();
    }, []);

    const getOtherParticipant = (thread) => {
        return thread.participant1.id === currentUser.id 
            ? thread.participant2 
            : thread.participant1;
    };

    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
        </Box>
    );

    if (error) return (
        <Box sx={{ p: 3 }}>
            <Typography color="error">{error}</Typography>
        </Box>
    );

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
            <Paper elevation={2}>
                <List>
                    {threads.length === 0 ? (
                        <ListItem>
                            <ListItemText 
                                primary="No conversations yet" 
                                secondary="Start a conversation by visiting someone's profile"
                            />
                        </ListItem>
                    ) : (
                        threads.map((thread, index) => {
                            const otherUser = getOtherParticipant(thread);
                            return (
                                <React.Fragment key={thread.id}>
                                    <ListItem 
                                        button 
                                        onClick={() => navigate(`/messages/thread/${otherUser.id}`)}
                                    >
                                        <ListItemAvatar>
                                            <Avatar src={otherUser.profile_picture}>
                                                {otherUser.username[0].toUpperCase()}
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={otherUser.username}
                                            secondary={
                                                thread.last_message ? (
                                                    <>
                                                        <Typography
                                                            component="span"
                                                            variant="body2"
                                                            color="text.primary"
                                                            sx={{ display: 'block' }}
                                                        >
                                                            {thread.last_message.text}
                                                        </Typography>
                                                        {new Date(thread.last_message.timestamp).toLocaleString()}
                                                    </>
                                                ) : 'No messages yet'
                                            }
                                        />
                                    </ListItem>
                                    {index < threads.length - 1 && <Divider />}
                                </React.Fragment>
                            );
                        })
                    )}
                </List>
            </Paper>
        </Box>
    );
};

export default ThreadList; 