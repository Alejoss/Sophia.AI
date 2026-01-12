import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  Avatar,
  Alert,
  CircularProgress,
  Divider,
  Paper
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CurrencyBitcoin as CryptoIcon
} from '@mui/icons-material';
import { 
  getCryptocurrencies, 
  getUserAcceptedCryptos, 
  addAcceptedCrypto, 
  deleteAcceptedCrypto 
} from '../api/profilesApi';

const FavoriteCryptos = ({ isOwnProfile = false, userId = null }) => {
  const [acceptedCryptos, setAcceptedCryptos] = useState([]);
  const [availableCryptos, setAvailableCryptos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch user's accepted cryptocurrencies
      const acceptedData = await getUserAcceptedCryptos(userId);
      setAcceptedCryptos(acceptedData);
      
      // If it's own profile, also fetch available cryptocurrencies for the dropdown
      if (isOwnProfile) {
        const availableData = await getCryptocurrencies();
        setAvailableCryptos(availableData);
      }
    } catch (err) {
      console.error('Error fetching cryptocurrency data:', err);
      setError('Failed to load cryptocurrency data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCrypto = async () => {
    if (!selectedCrypto || !address.trim()) {
      setSubmitError('Por favor selecciona una criptomoneda e ingresa una dirección');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError('');
      
      await addAcceptedCrypto(selectedCrypto, address.trim());
      
      // Reset form and close modal
      setSelectedCrypto('');
      setAddress('');
      setModalOpen(false);
      
      // Refresh the list
      await fetchData();
    } catch (err) {
      console.error('Error adding cryptocurrency:', err);
      setSubmitError(err.response?.data?.error || 'Error al agregar la criptomoneda');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCrypto = async (cryptoId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta criptomoneda?')) {
      return;
    }

    try {
      await deleteAcceptedCrypto(cryptoId);
      await fetchData(); // Refresh the list
    } catch (err) {
      console.error('Error deleting cryptocurrency:', err);
      setError('Error al eliminar la criptomoneda');
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedCrypto('');
    setAddress('');
    setSubmitError('');
  };

  const getSelectedCryptoData = () => {
    return availableCryptos.find(crypto => crypto.id.toString() === selectedCrypto);
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
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  const filteredCryptos = acceptedCryptos.filter(crypto => !crypto.deleted);

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap:'wrap',  justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Criptomonedas favoritas
        </Typography>
        {isOwnProfile && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setModalOpen(true)}
          >
            Agregar criptomoneda
          </Button>
        )}
      </Box>

      {isOwnProfile && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Recibirás pagos en estas criptomonedas
        </Alert>
      )}

      {filteredCryptos.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CryptoIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Aún no se han agregado criptomonedas
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isOwnProfile 
                  ? 'Agrega tus criptomonedas favoritas para recibir pagos'
                  : 'Este usuario aún no ha agregado ninguna criptomoneda'
                }
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Paper elevation={1}>
          <List>
            {filteredCryptos.map((acceptedCrypto, index) => (
              <React.Fragment key={acceptedCrypto.id}>
                <ListItem alignItems="flex-start">
                  <ListItemAvatar>
                    {acceptedCrypto.crypto.thumbnail ? (
                      (() => {
                        const isSvg = acceptedCrypto.crypto.thumbnail.toLowerCase().endsWith('.svg');
                        if (isSvg) {
                          return (
                            <Avatar sx={{ width: 48, height: 48, bgcolor: 'background.paper' }}>
                              <img 
                                src={acceptedCrypto.crypto.thumbnail} 
                                alt={acceptedCrypto.crypto.name}
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              />
                            </Avatar>
                          );
                        } else {
                          return (
                            <Avatar 
                              src={acceptedCrypto.crypto.thumbnail} 
                              sx={{ width: 48, height: 48 }}
                            />
                          );
                        }
                      })()
                    ) : (
                      <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}>
                        <CryptoIcon />
                      </Avatar>
                    )}
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6" component="span">
                          {acceptedCrypto.crypto.name}
                        </Typography>
                        <Chip 
                          label={acceptedCrypto.crypto.code} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      isOwnProfile && (
                        <Typography 
                          variant="body2" 
                          color="text.secondary" 
                          sx={{ wordBreak: 'break-all', mt: 1 }}
                        >
                          <strong>Dirección:</strong> {acceptedCrypto.address}
                        </Typography>
                      )
                    }
                  />
                  {isOwnProfile && (
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        color="error"
                        onClick={() => handleDeleteCrypto(acceptedCrypto.crypto.id)}
                        title="Eliminar criptomoneda"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
                {index < filteredCryptos.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}

      {/* Add Cryptocurrency Modal */}
      <Dialog open={modalOpen} onClose={handleModalClose} maxWidth="sm" fullWidth>
        <DialogTitle>Agregar criptomoneda</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Seleccionar criptomoneda</InputLabel>
              <Select
                value={selectedCrypto}
                onChange={(e) => setSelectedCrypto(e.target.value)}
                label="Seleccionar criptomoneda"
              >
                {availableCryptos.map((crypto) => (
                  <MenuItem key={crypto.id} value={crypto.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2">{crypto.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {crypto.code}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Dirección de billetera"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ingresa tu dirección de billetera"
              multiline
              rows={3}
              sx={{ mb: 2 }}
            />

            {submitError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {submitError}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleModalClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button 
            onClick={handleAddCrypto} 
            variant="contained" 
            disabled={submitting || !selectedCrypto || !address.trim()}
          >
            {submitting ? <CircularProgress size={20} /> : 'Agregar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FavoriteCryptos; 