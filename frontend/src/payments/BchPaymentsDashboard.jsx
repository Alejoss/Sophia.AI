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
  confirmAdminBchOrder,
  getAdminBchCatalog,
  getAdminBchOrders,
  updateKnowledgePathBch,
  updateTopicBch,
} from '../api/paymentsApi';

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'for_sale', label: 'En venta' },
  { value: 'paid', label: 'Con precio' },
  { value: 'free', label: 'Sin precio' },
];

const ORDER_STATUS_LABEL = {
  pending: 'Pendiente',
  expired: 'Expirada',
  cancelled: 'Cancelada',
  paid: 'Pagada',
};

const formatError = (err, fallback) => {
  const msg = err?.error || err?.detail || err?.message || err?.response?.data?.error;
  if (typeof msg === 'string') return msg;
  return fallback;
};

const matchesFilter = (item, filter, paidKey) => {
  if (filter === 'for_sale') return Boolean(item.is_for_sale);
  if (filter === 'paid') return Boolean(item[paidKey]);
  if (filter === 'free') return !item[paidKey];
  return true;
};

const productLabel = (order) => {
  if (order.product_type === 'path') return 'Camino';
  if (order.product_type === 'topic') return 'Consultas';
  if (order.product_type === 'anchor') return 'Anclaje';
  if (order.product_type === 'token_package') return 'Tokens';
  return 'Producto';
};

const productLink = (order) => {
  if (order.product_type === 'path' && order.product_id) {
    return `/knowledge_path/${order.product_id}`;
  }
  if (order.product_type === 'topic' && order.product_id) {
    return `/content/topics/${order.product_id}`;
  }
  return null;
};

const BchPaymentsDashboard = () => {
  const [catalog, setCatalog] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filter, setFilter] = useState('all');
  const [savingKey, setSavingKey] = useState(null);
  const [pathPrices, setPathPrices] = useState({});
  const [topicPrices, setTopicPrices] = useState({});
  const [txidDrafts, setTxidDrafts] = useState({});

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const [catalogData, ordersData] = await Promise.all([
        getAdminBchCatalog(),
        getAdminBchOrders({ status: 'pending,expired,cancelled', limit: 50 }),
      ]);
      setCatalog(catalogData);
      setOrders(ordersData?.orders || []);
      const drafts = {};
      (ordersData?.orders || []).forEach((order) => {
        if (order.reported_txid) {
          drafts[order.id] = order.reported_txid;
        }
      });
      setTxidDrafts(drafts);
      const nextPathPrices = {};
      (catalogData.knowledge_paths || []).forEach((path) => {
        nextPathPrices[path.id] = String(path.reference_price ?? 0);
      });
      setPathPrices(nextPathPrices);
      const nextTopicPrices = {};
      (catalogData.topics || []).forEach((topic) => {
        nextTopicPrices[topic.id] = String(topic.reference_price ?? 0);
      });
      setTopicPrices(nextTopicPrices);
      setError(null);
    } catch (err) {
      setError(formatError(err, 'No se pudo cargar el panel de pagos BCH.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const paths = catalog?.knowledge_paths || [];
  const topics = catalog?.topics || [];
  const configured = Boolean(catalog?.bch_direct_configured);
  const network = catalog?.bch_network;

  const filteredPaths = useMemo(
    () => paths.filter((item) => matchesFilter(item, filter, 'is_paid_path')),
    [paths, filter],
  );
  const filteredTopics = useMemo(
    () => topics.filter((item) => matchesFilter(item, filter, 'is_paid_topic')),
    [topics, filter],
  );

  const handlePathToggle = async (path, nextEnabled) => {
    setSavingKey(`path-${path.id}`);
    setError(null);
    try {
      const updated = await updateKnowledgePathBch(path.id, { sales_enabled: nextEnabled });
      setCatalog((prev) => ({
        ...prev,
        knowledge_paths: (prev.knowledge_paths || []).map((item) => (
          item.id === path.id ? { ...item, ...updated } : item
        )),
      }));
      if (updated?.reference_price !== undefined) {
        setPathPrices((prev) => ({ ...prev, [path.id]: String(updated.reference_price ?? 0) }));
      }
    } catch (err) {
      setError(formatError(err, 'No se pudo actualizar el camino.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handlePathPriceSave = async (path) => {
    const raw = pathPrices[path.id];
    const price = Number(raw);
    if (Number.isNaN(price) || price < 0) {
      setError('El precio del camino debe ser un número mayor o igual a 0.');
      return;
    }
    setSavingKey(`path-price-${path.id}`);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateKnowledgePathBch(path.id, { reference_price: price });
      setCatalog((prev) => ({
        ...prev,
        knowledge_paths: (prev.knowledge_paths || []).map((item) => (
          item.id === path.id ? { ...item, ...updated } : item
        )),
      }));
      setPathPrices((prev) => ({ ...prev, [path.id]: String(updated.reference_price ?? 0) }));
      setSuccess(`Precio del camino «${path.title}» actualizado.`);
    } catch (err) {
      setError(formatError(err, 'No se pudo guardar el precio del camino.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleTopicToggle = async (topic, nextEnabled) => {
    setSavingKey(`topic-${topic.id}`);
    setError(null);
    try {
      const updated = await updateTopicBch(topic.id, { sales_enabled: nextEnabled });
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

  const handleConfirmOrder = async (order) => {
    const txid = (txidDrafts[order.id] || '').trim();
    if (!txid) {
      setError('Pega el TXID que te envió el comprador antes de confirmar.');
      return;
    }
    setSavingKey(`order-${order.id}`);
    setError(null);
    setSuccess(null);
    try {
      const result = await confirmAdminBchOrder(order.id, txid);
      setOrders((prev) => prev.filter((item) => item.id !== order.id));
      setTxidDrafts((prev) => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
      setSuccess(
        result?.detail
        || `Orden #${order.id} confirmada. Acceso desbloqueado para ${order.buyer_username || 'el comprador'}.`,
      );
    } catch (err) {
      setError(formatError(err, 'No se pudo confirmar el pago BCH.'));
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
            Edita el precio de caminos y temas, y activa o pausa la venta. Si
            están en venta, el checkout ofrece NOWPayments, Bitcoin Cash y
            Monero. También confirma pagos BCH reportados por TXID.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            color={configured ? 'success' : 'warning'}
            label={configured ? `BCH servidor · ${network || 'red'}` : 'BCH no configurado'}
          />
          <Chip size="small" color="warning" label={`${orders.length} por confirmar`} />
          <Chip size="small" color="success" label={`${paths.filter((p) => p.is_for_sale).length} en venta`} />
          <Chip size="small" color="info" label={`${topics.filter((t) => t.is_for_sale).length} temas`} />
        </Stack>
      </Stack>

      {!configured && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Configura BCH_RECEIVE_ADDRESS (o la dirección de la red activa) en el
          servidor para que el checkout BCH aparezca a los alumnos.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        Confirmar pagos reportados
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Cuando un comprador reporta el TXID (orden expirada o fallo de
        verificación), llega aquí precompletado. Revisa la cadena y confirma
        para desbloquear el acceso. También recibes un aviso en notificaciones
        y por email.
      </Typography>
      {orders.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          No hay órdenes BCH pendientes, expiradas o canceladas.
        </Typography>
      ) : (
        <Paper variant="outlined" sx={{ mb: 4 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Orden</TableCell>
                <TableCell>Comprador</TableCell>
                <TableCell>Producto</TableCell>
                <TableCell>Monto</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>TXID</TableCell>
                <TableCell align="right">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => {
                const link = productLink(order);
                return (
                  <TableRow key={order.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        #{order.id}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', fontFamily: 'monospace', wordBreak: 'break-all' }}
                      >
                        {order.address}
                      </Typography>
                    </TableCell>
                    <TableCell>{order.buyer_username || '—'}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {productLabel(order)}
                        {order.product_title ? `: ${order.product_title}` : ''}
                      </Typography>
                      {link && (
                        <Button size="small" component={RouterLink} to={link} sx={{ px: 0 }}>
                          Ver
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {order.expected_amount_bch} BCH
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.expected_amount_sats} sats · ${Number(order.usd_amount || 0).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={order.status === 'pending' ? 'warning' : 'default'}
                        label={ORDER_STATUS_LABEL[order.status] || order.status}
                      />
                      {order.reported_txid ? (
                        <Chip
                          size="small"
                          color="info"
                          label="TXID reportado"
                          sx={{ mt: 0.5, display: 'flex' }}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell sx={{ minWidth: 220 }}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="TXID (64 hex)"
                        value={txidDrafts[order.id] || ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          setTxidDrafts((prev) => ({ ...prev, [order.id]: value }));
                        }}
                        inputProps={{ spellCheck: false, autoComplete: 'off' }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="contained"
                        disabled={savingKey === `order-${order.id}`}
                        onClick={() => handleConfirmOrder(order)}
                      >
                        {savingKey === `order-${order.id}` ? 'Confirmando…' : 'Confirmar pago'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
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
                <TableCell>En venta</TableCell>
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
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        size="small"
                        type="number"
                        inputProps={{ min: 0, step: '0.01' }}
                        value={pathPrices[path.id] ?? '0'}
                        onChange={(event) => {
                          const value = event.target.value;
                          setPathPrices((prev) => ({ ...prev, [path.id]: value }));
                        }}
                        sx={{ width: 110 }}
                      />
                      <Button
                        size="small"
                        disabled={savingKey === `path-price-${path.id}`}
                        onClick={() => handlePathPriceSave(path)}
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
                          checked={Boolean(path.sales_enabled && path.is_paid_path)}
                          disabled={!path.is_paid_path || savingKey === `path-${path.id}`}
                          onChange={(event) => handlePathToggle(path, event.target.checked)}
                        />
                      }
                      label={path.is_for_sale ? 'On' : 'Off'}
                    />
                    {!path.is_paid_path && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Guarda un precio mayor a 0 para poner en venta.
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
                <TableCell>En venta</TableCell>
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
                          checked={Boolean(topic.sales_enabled && topic.is_paid_topic)}
                          disabled={!topic.is_paid_topic || savingKey === `topic-${topic.id}`}
                          onChange={(event) => handleTopicToggle(topic, event.target.checked)}
                        />
                      }
                      label={topic.is_for_sale ? 'On' : 'Off'}
                    />
                    {!topic.is_paid_topic && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Guarda un precio mayor a 0 para poner en venta.
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
