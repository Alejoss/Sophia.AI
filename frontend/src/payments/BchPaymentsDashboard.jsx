import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  getAdminBchCatalog,
  updateKnowledgePathBch,
  updateTopicBch,
} from '../api/paymentsApi';

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'enabled', label: 'BCH activo' },
  { value: 'paid', label: 'Con precio' },
  { value: 'free', label: 'Sin precio' },
];

const formatError = (err, fallback) => {
  const msg = err?.error || err?.detail || err?.message || err?.response?.data?.error;
  if (typeof msg === 'string') return msg;
  return fallback;
};

const matchesFilter = (item, filter, enabledKey, paidKey) => {
  if (filter === 'enabled') return Boolean(item[enabledKey]);
  if (filter === 'paid') return Boolean(item[paidKey]);
  if (filter === 'free') return !item[paidKey];
  return true;
};

const BchPaymentsDashboard = () => {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [savingKey, setSavingKey] = useState(null);
  const [topicPrices, setTopicPrices] = useState({});

  const loadCatalog = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAdminBchCatalog();
      setCatalog(data);
      const prices = {};
      (data.topics || []).forEach((topic) => {
        prices[topic.id] = String(topic.reference_price ?? 0);
      });
      setTopicPrices(prices);
      setError(null);
    } catch (err) {
      setError(formatError(err, 'No se pudo cargar el catálogo de pagos BCH.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const paths = catalog?.knowledge_paths || [];
  const topics = catalog?.topics || [];
  const configured = Boolean(catalog?.bch_direct_configured);
  const network = catalog?.bch_network;

  const filteredPaths = useMemo(
    () => paths.filter((item) => matchesFilter(item, filter, 'bch_direct_enabled', 'is_paid_path')),
    [paths, filter],
  );
  const filteredTopics = useMemo(
    () => topics.filter((item) => matchesFilter(item, filter, 'bch_direct_enabled', 'is_paid_topic')),
    [topics, filter],
  );

  const handlePathToggle = async (path, nextEnabled) => {
    setSavingKey(`path-${path.id}`);
    setError(null);
    try {
      const updated = await updateKnowledgePathBch(path.id, { bch_direct_enabled: nextEnabled });
      setCatalog((prev) => ({
        ...prev,
        knowledge_paths: (prev.knowledge_paths || []).map((item) => (
          item.id === path.id ? { ...item, ...updated } : item
        )),
      }));
    } catch (err) {
      setError(formatError(err, 'No se pudo actualizar el camino.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleTopicToggle = async (topic, nextEnabled) => {
    setSavingKey(`topic-${topic.id}`);
    setError(null);
    try {
      const updated = await updateTopicBch(topic.id, { bch_direct_enabled: nextEnabled });
      setCatalog((prev) => ({
        ...prev,
        topics: (prev.topics || []).map((item) => (
          item.id === topic.id ? { ...item, ...updated } : item
        )),
      }));
    } catch (err) {
      setError(formatError(err, 'No se pudo actualizar el tema.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleTopicPriceSave = async (topic) => {
    const raw = topicPrices[topic.id];
    const price = Number(raw);
    if (Number.isNaN(price) || price < 0) {
      setError('El precio del tema debe ser un número mayor o igual a 0.');
      return;
    }
    setSavingKey(`topic-price-${topic.id}`);
    setError(null);
    try {
      const updated = await updateTopicBch(topic.id, { reference_price: price });
      setCatalog((prev) => ({
        ...prev,
        topics: (prev.topics || []).map((item) => (
          item.id === topic.id ? { ...item, ...updated } : item
        )),
      }));
      setTopicPrices((prev) => ({ ...prev, [topic.id]: String(updated.reference_price ?? 0) }));
    } catch (err) {
      setError(formatError(err, 'No se pudo guardar el precio del tema.'));
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 6 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" gutterBottom>
            Pagos Bitcoin Cash
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Activa el cobro autocustodia en BCH para caminos de conocimiento
            (desbloqueo de nodos) o temas (Consultas). El precio del camino lo
            define el autor; el del tema se configura aquí.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            color={configured ? 'success' : 'warning'}
            label={configured ? `BCH servidor · ${network || 'red'}` : 'BCH no configurado'}
          />
          <Chip size="small" color="success" label={`${paths.filter((p) => p.bch_direct_enabled).length} caminos`} />
          <Chip size="small" color="info" label={`${topics.filter((t) => t.bch_direct_enabled).length} temas`} />
        </Stack>
      </Stack>

      {!configured && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Configura BCH_RECEIVE_ADDRESS (o la dirección de la red activa) en el
          servidor para que el checkout BCH aparezca a los alumnos.
        </Alert>
      )}

      <ToggleButtonGroup
        exclusive
        size="small"
        value={filter}
        onChange={(_event, value) => {
          if (value) setFilter(value);
        }}
        sx={{ mb: 2 }}
      >
        {FILTERS.map((item) => (
          <ToggleButton key={item.value} value={item.value}>
            {item.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        Caminos del conocimiento
      </Typography>
      {filteredPaths.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          No hay caminos en este filtro.
        </Typography>
      ) : (
        <Paper variant="outlined" sx={{ mb: 4 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Camino</TableCell>
                <TableCell>Autor</TableCell>
                <TableCell>Precio</TableCell>
                <TableCell>BCH</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPaths.map((path) => (
                <TableRow key={path.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {path.title}
                    </Typography>
                    {!path.is_visible && (
                      <Chip size="small" label="Oculto" sx={{ mt: 0.5 }} />
                    )}
                  </TableCell>
                  <TableCell>{path.author || '—'}</TableCell>
                  <TableCell>
                    {path.is_paid_path
                      ? `$${Number(path.reference_price).toFixed(2)}`
                      : 'Gratis'}
                  </TableCell>
                  <TableCell>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={Boolean(path.bch_direct_enabled)}
                          disabled={!path.is_paid_path || savingKey === `path-${path.id}`}
                          onChange={(event) => handlePathToggle(path, event.target.checked)}
                        />
                      }
                      label={path.bch_direct_enabled ? 'On' : 'Off'}
                    />
                    {!path.is_paid_path && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        El autor debe poner un precio mayor a 0.
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" component={RouterLink} to={`/knowledge_path/${path.id}`}>
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        Temas (Consultas)
      </Typography>
      {filteredTopics.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No hay temas en este filtro.
        </Typography>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tema</TableCell>
                <TableCell>Creador</TableCell>
                <TableCell>Precio Consultas</TableCell>
                <TableCell>BCH</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTopics.map((topic) => (
                <TableRow key={topic.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {topic.title}
                    </Typography>
                    {!topic.is_public && (
                      <Chip size="small" label="Privado" sx={{ mt: 0.5 }} />
                    )}
                  </TableCell>
                  <TableCell>{topic.creator || '—'}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        size="small"
                        type="number"
                        inputProps={{ min: 0, step: '0.01' }}
                        value={topicPrices[topic.id] ?? '0'}
                        onChange={(event) => {
                          const value = event.target.value;
                          setTopicPrices((prev) => ({ ...prev, [topic.id]: value }));
                        }}
                        sx={{ width: 110 }}
                      />
                      <Button
                        size="small"
                        disabled={savingKey === `topic-price-${topic.id}`}
                        onClick={() => handleTopicPriceSave(topic)}
                      >
                        Guardar
                      </Button>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={Boolean(topic.bch_direct_enabled)}
                          disabled={!topic.is_paid_topic || savingKey === `topic-${topic.id}`}
                          onChange={(event) => handleTopicToggle(topic, event.target.checked)}
                        />
                      }
                      label={topic.bch_direct_enabled ? 'On' : 'Off'}
                    />
                    {!topic.is_paid_topic && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Guarda un precio mayor a 0 para activar BCH.
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" component={RouterLink} to={`/content/topics/${topic.id}`}>
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
};

export default BchPaymentsDashboard;
