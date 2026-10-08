import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const FILTER_VALUES = ['all', 'for_sale', 'paid', 'free'];

const PRODUCT_TYPE_KEYS = ['path', 'topic', 'anchor', 'token_package', 'course'];

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

const productTypeKey = (order) => (
  PRODUCT_TYPE_KEYS.includes(order.product_type) ? order.product_type : 'generic'
);

const productLink = (order) => {
  if (order.product_type === 'path' && order.product_id) {
    return `/knowledge_path/${order.product_id}`;
  }
  if (order.product_type === 'topic' && order.product_id) {
    return `/content/topics/${order.product_id}`;
  }
  if (order.product_type === 'course' && order.product_id) {
    return `/cursos/${order.product_id}`;
  }
  return null;
};

const BchPaymentsDashboard = () => {
  const { t } = useTranslation('payments');
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
      setError(formatError(err, t('admin.loadError')));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      setError(formatError(err, t('admin.pathUpdateError')));
    } finally {
      setSavingKey(null);
    }
  };

  const handlePathPriceSave = async (path) => {
    const raw = pathPrices[path.id];
    const price = Number(raw);
    if (Number.isNaN(price) || price < 0) {
      setError(t('admin.pathPriceInvalid'));
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
      setSuccess(t('admin.pathPriceUpdated', { title: path.title }));
    } catch (err) {
      setError(formatError(err, t('admin.pathPriceError')));
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
      setError(formatError(err, t('admin.topicUpdateError')));
    } finally {
      setSavingKey(null);
    }
  };

  const handleTopicPriceSave = async (topic) => {
    const raw = topicPrices[topic.id];
    const price = Number(raw);
    if (Number.isNaN(price) || price < 0) {
      setError(t('admin.topicPriceInvalid'));
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
      setError(formatError(err, t('admin.topicPriceError')));
    } finally {
      setSavingKey(null);
    }
  };

  const handleConfirmOrder = async (order) => {
    const txid = (txidDrafts[order.id] || '').trim();
    if (!txid) {
      setError(t('admin.txidRequired'));
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
        || t('admin.orderConfirmed', {
          id: order.id,
          buyer: order.buyer_username || t('admin.buyerFallback'),
        }),
      );
    } catch (err) {
      setError(formatError(err, t('admin.confirmError')));
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
            {t('admin.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('admin.intro')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            color={configured ? 'success' : 'warning'}
            label={configured
              ? t('admin.serverChip', { network: network || t('admin.networkFallback') })
              : t('admin.notConfigured')}
          />
          <Chip size="small" color="warning" label={t('admin.toConfirm', { count: orders.length })} />
          <Chip size="small" color="success" label={t('admin.forSale', { count: paths.filter((p) => p.is_for_sale).length })} />
          <Chip size="small" color="info" label={t('admin.topicsChip', { count: topics.filter((item) => item.is_for_sale).length })} />
        </Stack>
      </Stack>

      {!configured && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('admin.configureAddress')}
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
        {t('admin.confirmReported')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t('admin.confirmHelp')}
      </Typography>
      {orders.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          {t('admin.noOrders')}
        </Typography>
      ) : (
        <Paper variant="outlined" sx={{ mb: 4 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.order')}</TableCell>
                <TableCell>{t('admin.buyer')}</TableCell>
                <TableCell>{t('admin.product')}</TableCell>
                <TableCell>{t('admin.amount')}</TableCell>
                <TableCell>{t('admin.status')}</TableCell>
                <TableCell>TXID</TableCell>
                <TableCell align="right">{t('admin.action')}</TableCell>
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
                        {t(`admin.productType.${productTypeKey(order)}`)}
                        {order.product_title ? `: ${order.product_title}` : ''}
                      </Typography>
                      {link && (
                        <Button size="small" component={RouterLink} to={link} sx={{ px: 0 }}>
                          {t('admin.view')}
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
                        label={t(`admin.orderStatus.${order.status}`, { defaultValue: order.status })}
                      />
                      {order.reported_txid ? (
                        <Chip
                          size="small"
                          color="info"
                          label={t('admin.txidReported')}
                          sx={{ mt: 0.5, display: 'flex' }}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell sx={{ minWidth: 220 }}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder={t('admin.txidPlaceholder')}
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
                        {savingKey === `order-${order.id}` ? t('admin.confirming') : t('admin.confirmPayment')}
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
        {FILTER_VALUES.map((value) => (
          <ToggleButton key={value} value={value}>
            {t(`admin.filters.${value}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Typography variant="h6" sx={{ mb: 1 }}>
        {t('admin.pathsTitle')}
      </Typography>
      {filteredPaths.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('admin.noPaths')}
        </Typography>
      ) : (
        <Paper variant="outlined" sx={{ mb: 4 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.path')}</TableCell>
                <TableCell>{t('admin.author')}</TableCell>
                <TableCell>{t('admin.price')}</TableCell>
                <TableCell>{t('admin.forSale')}</TableCell>
                <TableCell align="right">{t('admin.actions')}</TableCell>
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
                      <Chip size="small" label={t('admin.hidden')} sx={{ mt: 0.5 }} />
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
                        {t('admin.save')}
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
                      label={path.is_for_sale ? t('admin.saleOn') : t('admin.saleOff')}
                    />
                    {!path.is_paid_path && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('admin.savePriceHint')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" component={RouterLink} to={`/knowledge_path/${path.id}`}>
                      {t('admin.view')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        {t('admin.topicsTitle')}
      </Typography>
      {filteredTopics.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('admin.noTopics')}
        </Typography>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.topic')}</TableCell>
                <TableCell>{t('admin.creator')}</TableCell>
                <TableCell>{t('admin.consultPrice')}</TableCell>
                <TableCell>{t('admin.forSale')}</TableCell>
                <TableCell align="right">{t('admin.actions')}</TableCell>
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
                      <Chip size="small" label={t('admin.private')} sx={{ mt: 0.5 }} />
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
                        {t('admin.save')}
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
                      label={topic.is_for_sale ? t('admin.saleOn') : t('admin.saleOff')}
                    />
                    {!topic.is_paid_topic && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('admin.savePriceHint')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" component={RouterLink} to={`/content/topics/${topic.id}`}>
                      {t('admin.view')}
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
