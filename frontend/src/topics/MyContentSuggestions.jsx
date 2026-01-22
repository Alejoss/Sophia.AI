import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    Alert,
    CircularProgress,
    Chip,
    Card,
    CardContent,
    CardActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Divider
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/Pending';
import contentApi from '../api/contentApi';

const MyContentSuggestions = () => {
    const navigate = useNavigate();
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchSuggestions();
    }, [statusFilter]);

    const fetchSuggestions = async () => {
        try {
            setLoading(true);
            const filters = {};
            if (statusFilter && statusFilter !== 'all') {
                filters.status = statusFilter;
            }
            const data = await contentApi.getUserContentSuggestions(filters);
            setSuggestions(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err) {
            setError('Error al cargar tus sugerencias');
            console.error('Error fetching suggestions:', err);
        } finally {
            setLoading(false);
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

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                {error}
            </Alert>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" gutterBottom>
                    Mis Sugerencias de Contenido
                </Typography>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Filtrar por estado</InputLabel>
                    <Select
                        value={statusFilter}
                        label="Filtrar por estado"
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <MenuItem value="all">Todas</MenuItem>
                        <MenuItem value="PENDING">Pendientes</MenuItem>
                        <MenuItem value="ACCEPTED">Aceptadas</MenuItem>
                        <MenuItem value="REJECTED">Rechazadas</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            {suggestions.length === 0 ? (
                <Alert severity="info">
                    No tienes sugerencias de contenido.
                </Alert>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {suggestions.map((suggestion) => (
                        <Card key={suggestion.id} variant="outlined">
                            <CardContent>
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

                                {suggestion.message && (
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
                            <CardActions>
                                <Button 
                                    size="small" 
                                    onClick={() => navigate(`/content/topics/${suggestion.topic?.id}`)}
                                >
                                    Ver Tema
                                </Button>
                            </CardActions>
                        </Card>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default MyContentSuggestions;
