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

const TimelineEntryContentSuggestionsManager = ({ topicId, onSuggestionProcessed }) => {
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
      const data = await contentApi.getTopicTimelineEntryContentSuggestions(topicId, filters);
      setSuggestions(Array.isArray(data) ? data : []);
      setError(null);
    } catch {
      setError('Error al cargar las sugerencias de contenido para entradas');
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
      await contentApi.acceptTopicTimelineEntryContentSuggestion(topicId, suggestion.id);
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
      await contentApi.rejectTopicTimelineEntryContentSuggestion(
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
        Contenido sugerido para entradas
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Propuestas de la comunidad para vincular material a entradas existentes de la linea de tiempo.
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Al aceptar, el contenido se vinculara a la entrada indicada. Si aun no forma parte del tema,
        se anadira automaticamente. Las sugerencias de contenido pendientes para el mismo material
        se cerraran automaticamente.
      </Alert>

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
                <TableCell>Entrada</TableCell>
                <TableCell>Contenido</TableCell>
                <TableCell>Sugerido por</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {suggestions.map((suggestion) => {
                const isProcessing = processingIds.has(suggestion.id);
                const entry = suggestion.entry || {};
                const contentTitle = suggestion.content?.original_title || 'Sin titulo';
                const dateLabel = entry.end_date
                  ? `${formatDate(entry.start_date)} - ${formatDate(entry.end_date)}`
                  : formatDate(entry.start_date);

                return (
                  <TableRow key={suggestion.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {entry.title || '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {dateLabel}
                      </Typography>
                      {suggestion.message && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          Mensaje para moderadores: {suggestion.message}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{contentTitle}</Typography>
                      {suggestion.status === 'PENDING' && (
                        <Chip
                          size="small"
                          label={suggestion.is_in_topic ? 'Ya en el tema' : 'Se anadira al tema'}
                          color={suggestion.is_in_topic ? 'default' : 'primary'}
                          variant="outlined"
                          sx={{ mt: 0.5 }}
                        />
                      )}
                      {suggestion.is_duplicate && suggestion.status === 'PENDING' && (
                        <Chip
                          size="small"
                          label="Ya vinculado a la entrada"
                          color="warning"
                          variant="outlined"
                          sx={{ mt: 0.5, ml: 0.5 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>{suggestion.suggested_by?.username || '-'}</TableCell>
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
                    </TableCell>
                    <TableCell align="right">
                      {suggestion.status === 'PENDING' && (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Button
                            size="small"
                            color="success"
                            startIcon={<CheckCircleIcon />}
                            disabled={isProcessing}
                            onClick={() => handleAccept(suggestion)}
                          >
                            Aceptar
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<CancelIcon />}
                            disabled={isProcessing}
                            onClick={() => {
                              setSelectedSuggestion(suggestion);
                              setRejectDialogOpen(true);
                            }}
                          >
                            Rechazar
                          </Button>
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

      <Dialog open={rejectDialogOpen} onClose={() => !processingIds.size && setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rechazar sugerencia</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Razon del rechazo"
            fullWidth
            multiline
            minRows={3}
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)} disabled={processingIds.size > 0}>
            Cancelar
          </Button>
          <Button
            onClick={handleRejectConfirm}
            color="error"
            variant="contained"
            disabled={processingIds.size > 0 || !rejectionReason.trim()}
          >
            Rechazar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TimelineEntryContentSuggestionsManager;
