import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Alert,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    TextField,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Tooltip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SearchIcon from '@mui/icons-material/Search';
import contentApi from '../api/contentApi';

const ContentSuggestionsManager = ({ topicId, onSuggestionProcessed }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterStatus, setFilterStatus] = useState('PENDING');
    const [filterDuplicate, setFilterDuplicate] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [processingIds, setProcessingIds] = useState(new Set());
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const fetchSuggestions = async () => {
        try {
            setLoading(true);
            const filters = {};
            if (filterStatus && filterStatus !== 'all') {
                filters.status = filterStatus;
            }
            if (filterDuplicate !== 'all') {
                filters.is_duplicate = filterDuplicate === 'true';
            }
            
            const data = await contentApi.getTopicContentSuggestions(topicId, filters);
            setSuggestions(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err) {
            setError('Error al cargar las sugerencias');
            console.error('Error fetching suggestions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuggestions();
    }, [topicId, filterStatus, filterDuplicate]);

    const handleAccept = async (suggestion) => {
        setProcessingIds(prev => new Set(prev).add(suggestion.id));
        setError(null);
        
        try {
            await contentApi.acceptContentSuggestion(topicId, suggestion.id);
            await fetchSuggestions();
            if (onSuggestionProcessed) {
                onSuggestionProcessed();
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Error al aceptar la sugerencia');
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(suggestion.id);
                return newSet;
            });
        }
    };

    const handleRejectClick = (suggestion) => {
        setSelectedSuggestion(suggestion);
        setRejectionReason('');
        setRejectDialogOpen(true);
    };

    const handleRejectConfirm = async () => {
        if (!rejectionReason.trim()) {
            setError('Debe proporcionar una razón para rechazar');
            return;
        }

        setProcessingIds(prev => new Set(prev).add(selectedSuggestion.id));
        setError(null);
        
        try {
            await contentApi.rejectContentSuggestion(topicId, selectedSuggestion.id, rejectionReason);
            setRejectDialogOpen(false);
            setSelectedSuggestion(null);
            setRejectionReason('');
            await fetchSuggestions();
            if (onSuggestionProcessed) {
                onSuggestionProcessed();
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Error al rechazar la sugerencia');
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(selectedSuggestion.id);
                return newSet;
            });
        }
    };

    const getStatusChip = (status) => {
        const statusConfig = {
            PENDING: { label: 'Pendiente', color: 'warning' },
            ACCEPTED: { label: 'Aceptada', color: 'success' },
            REJECTED: { label: 'Rechazada', color: 'error' }
        };
        const config = statusConfig[status] || { label: status, color: 'default' };
        return <Chip label={config.label} color={config.color} size="small" />;
    };

    const filteredSuggestions = suggestions.filter(suggestion => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        const contentTitle = suggestion.content?.original_title || '';
        const suggesterName = suggestion.suggested_by?.username || '';
        return contentTitle.toLowerCase().includes(searchLower) || 
               suggesterName.toLowerCase().includes(searchLower);
    });

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Sugerencias de Contenido
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Estado</InputLabel>
                    <Select
                        value={filterStatus}
                        label="Estado"
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <MenuItem value="all">Todos</MenuItem>
                        <MenuItem value="PENDING">Pendientes</MenuItem>
                        <MenuItem value="ACCEPTED">Aceptadas</MenuItem>
                        <MenuItem value="REJECTED">Rechazadas</MenuItem>
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Duplicadas</InputLabel>
                    <Select
                        value={filterDuplicate}
                        label="Duplicadas"
                        onChange={(e) => setFilterDuplicate(e.target.value)}
                    >
                        <MenuItem value="all">Todas</MenuItem>
                        <MenuItem value="true">Solo duplicadas</MenuItem>
                        <MenuItem value="false">No duplicadas</MenuItem>
                    </Select>
                </FormControl>

                <TextField
                    size="small"
                    placeholder="Buscar contenido o sugeridor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    }}
                    sx={{ flexGrow: 1, maxWidth: 300 }}
                />
            </Box>

            {/* Suggestions Table */}
            {filteredSuggestions.length === 0 ? (
                <Alert severity="info">
                    No hay sugerencias que coincidan con los filtros seleccionados.
                </Alert>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Contenido</TableCell>
                                <TableCell>Sugerido por</TableCell>
                                <TableCell>Mensaje</TableCell>
                                <TableCell>Estado</TableCell>
                                <TableCell>Fecha</TableCell>
                                <TableCell align="right">Acciones</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredSuggestions.map((suggestion) => (
                                <TableRow key={suggestion.id}>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight="medium">
                                            {suggestion.content?.original_title || 'Sin título'}
                                        </Typography>
                                        {suggestion.is_duplicate && (
                                            <Chip 
                                                label="Duplicada" 
                                                size="small" 
                                                color="warning" 
                                                sx={{ mt: 0.5 }}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {suggestion.suggested_by?.username || 'Usuario desconocido'}
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                                            {suggestion.message || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        {getStatusChip(suggestion.status)}
                                    </TableCell>
                                    <TableCell>
                                        {suggestion.created_at ? new Date(suggestion.created_at).toLocaleDateString() : '-'}
                                    </TableCell>
                                    <TableCell align="right">
                                        {suggestion.status === 'PENDING' && (
                                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                                <Tooltip title="Aceptar">
                                                    <IconButton
                                                        color="success"
                                                        size="small"
                                                        onClick={() => handleAccept(suggestion)}
                                                        disabled={processingIds.has(suggestion.id)}
                                                    >
                                                        <CheckCircleIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Rechazar">
                                                    <IconButton
                                                        color="error"
                                                        size="small"
                                                        onClick={() => handleRejectClick(suggestion)}
                                                        disabled={processingIds.has(suggestion.id)}
                                                    >
                                                        <CancelIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        )}
                                        {suggestion.status === 'REJECTED' && suggestion.rejection_reason && (
                                            <Tooltip title={suggestion.rejection_reason}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Ver razón
                                                </Typography>
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Reject Dialog */}
            <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Rechazar Sugerencia</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Por favor, proporciona una razón para rechazar esta sugerencia de contenido.
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Razón de rechazo"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Explica por qué se rechaza esta sugerencia..."
                        required
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
                    <Button
                        onClick={handleRejectConfirm}
                        variant="contained"
                        color="error"
                        disabled={!rejectionReason.trim() || processingIds.has(selectedSuggestion?.id)}
                    >
                        Rechazar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ContentSuggestionsManager;
