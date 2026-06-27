import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import contentApi from '../../api/contentApi';

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
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

const TimelineEntrySuggestionsManager = ({ topicId, onSuggestionProcessed }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('PENDING');
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
      const data = await contentApi.getTopicTimelineEntrySuggestions(topicId, filters);
      setSuggestions(Array.isArray(data) ? data : []);
      setError(null);
    } catch {
      setError('Error al cargar las sugerencias de linea de tiempo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [topicId, filterStatus]);

  const handleAccept = async (suggestion) => {
    setProcessingIds((prev) => new Set(prev).add(suggestion.id));
    setError(null);
    try {
      await contentApi.acceptTopicTimelineEntrySuggestion(topicId, suggestion.id);
      await fetchSuggestions();
      onSuggestionProcessed?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al aceptar la sugerencia');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(suggestion.id);
        return next;
      });
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectionReason.trim()) {
      setError('Debe proporcionar una razon para rechazar');
      return;
    }

    setProcessingIds((prev) => new Set(prev).add(selectedSuggestion.id));
    setError(null);
    try {
      await contentApi.rejectTopicTimelineEntrySuggestion(
        topicId,
        selectedSuggestion.id,
        rejectionReason,
      );
      setRejectDialogOpen(false);
      setSelectedSuggestion(null);
      setRejectionReason('');
      await fetchSuggestions();
      onSuggestionProcessed?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al rechazar la sugerencia');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedSuggestion.id);
        return next;
      });
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Sugerencias de linea de tiempo
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Revisa propuestas de entradas narrativas enviadas por la comunidad.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Estado</InputLabel>
          <Select
            value={filterStatus}
            label="Estado"
            onChange={(event) => setFilterStatus(event.target.value)}
          >
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="PENDING">Pendientes</MenuItem>
            <MenuItem value="ACCEPTED">Aceptadas</MenuItem>
            <MenuItem value="REJECTED">Rechazadas</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : suggestions.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">No hay sugerencias para mostrar.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Titulo</TableCell>
                <TableCell>Fechas</TableCell>
                <TableCell>Sugerido por</TableCell>
                <TableCell>Contenidos</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {suggestions.map((suggestion) => {
                const isProcessing = processingIds.has(suggestion.id);
                const dateLabel = suggestion.end_date
                  ? `${formatDate(suggestion.start_date)} - ${formatDate(suggestion.end_date)}`
                  : formatDate(suggestion.start_date);
                return (
                  <TableRow key={suggestion.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {suggestion.title}
                      </Typography>
                      {suggestion.description && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {suggestion.description.slice(0, 120)}
                          {suggestion.description.length > 120 ? '...' : ''}
                        </Typography>
                      )}
                      {suggestion.message && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          Mensaje: {suggestion.message}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{dateLabel}</TableCell>
                    <TableCell>{suggestion.suggested_by?.username || '-'}</TableCell>
                    <TableCell>{(suggestion.contents || []).length}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={suggestion.status}
                        color={
                          suggestion.status === 'ACCEPTED'
                            ? 'success'
                            : suggestion.status === 'REJECTED'
                              ? 'error'
                              : 'warning'
                        }
                      />
                      {suggestion.is_duplicate && (
                        <Chip size="small" label="Duplicada" color="warning" sx={{ ml: 0.5 }} />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {suggestion.status === 'PENDING' && (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Aceptar">
                            <span>
                              <Button
                                size="small"
                                color="success"
                                startIcon={<CheckCircleIcon />}
                                disabled={isProcessing}
                                onClick={() => handleAccept(suggestion)}
                              >
                                Aceptar
                              </Button>
                            </span>
                          </Tooltip>
                          <Tooltip title="Rechazar">
                            <span>
                              <Button
                                size="small"
                                color="error"
                                startIcon={<CancelIcon />}
                                disabled={isProcessing}
                                onClick={() => {
                                  setSelectedSuggestion(suggestion);
                                  setRejectionReason('');
                                  setRejectDialogOpen(true);
                                }}
                              >
                                Rechazar
                              </Button>
                            </span>
                          </Tooltip>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rechazar sugerencia de linea de tiempo</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Razon del rechazo"
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={handleRejectConfirm}>
            Rechazar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TimelineEntrySuggestionsManager;
