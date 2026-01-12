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
    Divider,
    InputBase,
    IconButton
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

const ThreadList = ({ onThreadSelect }) => {
    const [threads, setThreads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { authState } = useContext(AuthContext);
    const currentUser = authState.user;
    const navigate = useNavigate();

    useEffect(() => {
        const loadThreads = async () => {
            try {
                const response = await fetchThreads();
                const threadsData = Array.isArray(response.data) ? response.data : 
                                  response.data.results ? response.data.results : [];
                setThreads(threadsData);
                setError(null);
            } catch (err) {
                console.error('Error loading threads:', err);
                setError('Error al cargar las conversaciones.');
            } finally {
                setLoading(false);
            }
        };
        loadThreads();
    }, []);

    const getOtherParticipant = (thread) => {
        if (!thread || !currentUser) return null;
        return thread.participant1.id === currentUser.id 
            ? thread.participant2 
            : thread.participant1;
    };

    const filteredThreads = threads.filter(thread => {
        const otherUser = getOtherParticipant(thread);
        return otherUser && otherUser.username.toLowerCase().includes(searchQuery.toLowerCase());
    });

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
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Mensajes</Typography>
                <Paper
                    component="form"
                    sx={{ p: '2px 4px', display: 'flex', alignItems: 'center' }}
                >
                    <InputBase
                        sx={{ ml: 1, flex: 1 }}
                        placeholder="Buscar conversaciones"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <IconButton type="button" sx={{ p: '10px' }}>
                        <SearchIcon />
                    </IconButton>
                </Paper>
            </Box>

            {/* Thread List */}
            <List sx={{ flex: 1, overflow: 'auto' }}>
                {!filteredThreads || filteredThreads.length === 0 ? (
                    <ListItem>
                        <ListItemText 
                            primary="No se encontraron conversaciones" 
                            secondary={searchQuery ? "Intente con un término de búsqueda diferente" : "Aún no hay conversaciones"}
                        />
                    </ListItem>
                ) : (
                    filteredThreads.map((thread, index) => {
                        const otherUser = getOtherParticipant(thread);
                        if (!otherUser) return null;
                        
                        return (
                            <React.Fragment key={`thread-${thread.id}-${index}`}>
                                <ListItem 
                                    onClick={() => onThreadSelect(otherUser.id)}
                                    sx={{
                                        '&:hover': {
                                            backgroundColor: 'action.hover'
                                        },
                                        cursor: 'pointer'
                                    }}
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
                                                        sx={{ 
                                                            display: 'block',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        {thread.last_message.text}
                                                    </Typography>
                                                    <Typography
                                                        component="span"
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        {new Date(thread.last_message.timestamp).toLocaleString('es-ES')}
                                                    </Typography>
                                                </>
                                            ) : 'Aún no hay mensajes'
                                        }
                                    />
                                </ListItem>
                                {index < filteredThreads.length - 1 && <Divider />}
                            </React.Fragment>
                        );
                    })
                )}
            </List>
        </Box>
    );
};

export default ThreadList; 