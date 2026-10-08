import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
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
  Paper,
  FormHelperText,
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
import { applyApiErrorsToForm } from '../utils/apiFormErrors.js';

const FavoriteCryptos = ({ isOwnProfile = false, userId = null }) => {
  const { t } = useTranslation('profiles');
  const addCryptoSchema = useMemo(
    () =>
      yup.object({
        selectedCrypto: yup.string().required(() => t('cryptos.selectRequired')),
        address: yup.string().default(''),
      }),
    [t],
  );
  const [acceptedCryptos, setAcceptedCryptos] = useState([]);
  const [availableCryptos, setAvailableCryptos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError: setFormError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(addCryptoSchema),
    defaultValues: { selectedCrypto: '', address: '' },
  });

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const acceptedData = await getUserAcceptedCryptos(userId);
      setAcceptedCryptos(acceptedData);

      if (isOwnProfile) {
        const availableData = await getCryptocurrencies();
        setAvailableCryptos(availableData);
      }
    } catch (err) {
      console.error('Error fetching cryptocurrency data:', err);
      setError(t('cryptos.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async ({ selectedCrypto, address }) => {
    setGeneralError('');

    try {
      await addAcceptedCrypto(selectedCrypto, address.trim() || '');

      reset({ selectedCrypto: '', address: '' });
      setModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Error adding cryptocurrency:', err);
      const { generalError: parsed } = applyApiErrorsToForm(
        err,
        setFormError,
        t('cryptos.addError'),
        { cryptocurrency: 'selectedCrypto', crypto: 'selectedCrypto' },
      );
      if (parsed) {
        setGeneralError(parsed);
      }
    }
  };

  const handleDeleteCrypto = async (cryptoId) => {
    if (!window.confirm(t('cryptos.confirmDelete'))) {
      return;
    }

    try {
      await deleteAcceptedCrypto(cryptoId);
      await fetchData();
    } catch (err) {
      console.error('Error deleting cryptocurrency:', err);
      setError(t('cryptos.deleteError'));
    }
  };

  const handleModalClose = () => {
    if (!isSubmitting) {
      setModalOpen(false);
      reset({ selectedCrypto: '', address: '' });
      setGeneralError('');
    }
  };

  const handleOpenModal = () => {
    reset({ selectedCrypto: '', address: '' });
    setGeneralError('');
    setModalOpen(true);
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
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            fontSize: {
              xs: "1.5rem",
              sm: "1.75rem",
              md: "2.125rem",
            },
            fontWeight: 600,
          }}
        >
          {t('cryptos.title')}
        </Typography>
        {isOwnProfile && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenModal}
          >
            {t('cryptos.add')}
          </Button>
        )}
      </Box>

      {isOwnProfile && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('cryptos.legalNotice')}
        </Alert>
      )}

      {filteredCryptos.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CryptoIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {t('cryptos.emptyTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isOwnProfile ? t('cryptos.emptyOwn') : t('cryptos.emptyOther')}
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
                        }
                        return (
                          <Avatar
                            src={acceptedCrypto.crypto.thumbnail}
                            sx={{ width: 48, height: 48 }}
                          />
                        );
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
                          {acceptedCrypto.address
                            ? t('cryptos.address', { address: acceptedCrypto.address })
                            : t('cryptos.platformAddress')}
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
                        title={t('cryptos.remove')}
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

      <Dialog open={modalOpen} onClose={handleModalClose} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogTitle>{t('cryptos.dialogTitle')}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              {generalError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {generalError}
                </Alert>
              )}

              <FormControl fullWidth sx={{ mb: 3 }} error={!!errors.selectedCrypto}>
                <InputLabel>{t('cryptos.select')}</InputLabel>
                <Controller
                  name="selectedCrypto"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      label={t('cryptos.select')}
                      disabled={isSubmitting}
                    >
                      {availableCryptos.map((crypto) => (
                        <MenuItem key={crypto.id} value={String(crypto.id)}>
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
                  )}
                />
                {errors.selectedCrypto && (
                  <FormHelperText>{errors.selectedCrypto.message}</FormHelperText>
                )}
              </FormControl>

              <TextField
                fullWidth
                label={t('cryptos.walletLabel')}
                placeholder={t('cryptos.walletPlaceholder')}
                helperText={errors.address?.message || t('cryptos.walletHelper')}
                error={!!errors.address}
                disabled={isSubmitting}
                sx={{ mb: 2 }}
                {...register('address')}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleModalClose} disabled={isSubmitting}>
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
            >
              {isSubmitting ? <CircularProgress size={20} /> : t('cryptos.submit')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};

export default FavoriteCryptos;
