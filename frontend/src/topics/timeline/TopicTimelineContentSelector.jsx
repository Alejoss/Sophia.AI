import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import contentApi from '../../api/contentApi';
import { formatDate } from '../../utils/dateUtils';

const DEFAULT_PAGE_SIZE = 25;

const MEDIA_TYPE_LABELS = {
  VIDEO: 'Video',
  AUDIO: 'Audio',
  IMAGE: 'Imagen',
  TEXT: 'Texto',
};

const getContentData = (item) => item?.content || item;

const getItemId = (item) => {
  const content = getContentData(item);
  return content?.id != null ? String(content.id) : null;
};

const normalizeItem = (item) => {
  const content = getContentData(item);
  const id = getItemId(item);
  if (!id) return null;
  return {
    id,
    title:
      item?.title ||
      item?.selected_profile?.title ||
      content?.selected_profile?.title ||
      content?.original_title ||
      'Contenido sin titulo',
    author:
      item?.author ||
      item?.selected_profile?.author ||
      content?.selected_profile?.author ||
      content?.original_author ||
      'Desconocido',
    mediaType: (content?.media_type || item?.media_type || 'TEXT').toUpperCase(),
    createdAt:
      item?.created_at ||
      content?.created_at ||
      item?.selected_profile?.created_at ||
      null,
    contentId: id,
  };
};

const buildInitialCache = (initialSelectedItems = []) => {
  const map = {};
  initialSelectedItems.forEach((raw) => {
    const item = normalizeItem(raw);
    if (item) map[item.id] = item;
  });
  return map;
};

const TopicTimelineContentSelector = ({
  topicId,
  selectedIds = [],
  initialSelectedItems = [],
  onSelectionChange,
}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(topicId));
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState('');
  const [sortField, setSortField] = useState('title');
  const [sortDirection, setSortDirection] = useState('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [itemCache, setItemCache] = useState(() => buildInitialCache(initialSelectedItems));

  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(searchQuery.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [searchDebounced, mediaTypeFilter, sortField, sortDirection, topicId]);

  const ordering = sortDirection === 'desc' ? `-${sortField}` : sortField;

  const loadPage = useCallback(async () => {
    if (!topicId) {
      setItems([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await contentApi.getTopicDetailsSimple(topicId, {
        page: page + 1,
        page_size: rowsPerPage,
        search: searchDebounced,
        media_type: mediaTypeFilter || undefined,
        ordering,
      });
      const rows = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data?.contents)
          ? data.contents
          : [];
      const normalized = rows.map(normalizeItem).filter(Boolean);
      setItems(normalized);
      setTotalCount(typeof data?.count === 'number' ? data.count : normalized.length);
      setItemCache((prev) => {
        const next = { ...prev };
        normalized.forEach((item) => {
          next[item.id] = item;
        });
        return next;
      });
    } catch (err) {
      console.error('TopicTimelineContentSelector: Error fetching contents:', err);
      setError('Error al cargar los contenidos del tema');
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [topicId, page, rowsPerPage, searchDebounced, mediaTypeFilter, ordering]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const selectedItems = useMemo(
    () => selectedIds.map((id) => {
      const key = String(id);
      return itemCache[key] || { id: key, title: `Contenido #${key}`, contentId: key };
    }),
    [selectedIds, itemCache],
  );

  const setSelectedIds = (nextIds) => {
    onSelectionChange([...new Set(nextIds.map(String))]);
  };

  const handleToggle = (item) => {
    const itemId = item.id;
    if (selectedSet.has(itemId)) {
      setSelectedIds(selectedIds.filter((id) => String(id) !== itemId));
    } else {
      setItemCache((prev) => ({ ...prev, [itemId]: item }));
      setSelectedIds([...selectedIds, itemId]);
    }
  };

  const handleSelectVisible = (event) => {
    const visibleIds = items.map((item) => item.id);
    if (event.target.checked) {
      setItemCache((prev) => {
        const next = { ...prev };
        items.forEach((item) => {
          next[item.id] = item;
        });
        return next;
      });
      setSelectedIds([...selectedIds, ...visibleIds]);
    } else {
      setSelectedIds(selectedIds.filter((id) => !visibleIds.includes(String(id))));
    }
  };

  const visibleSelectedCount = items.filter((item) => selectedSet.has(item.id)).length;
  const allVisibleSelected = items.length > 0 && visibleSelectedCount === items.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  return (
    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Contenidos del tema
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Selecciona uno o varios contenidos ya agregados al tema.
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
          <TextField
            placeholder="Buscar por titulo, autor o tipo..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            size="small"
            disabled={!topicId}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ flexGrow: 1, minWidth: { md: 240 } }}
          />

          <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 160 } }} disabled={!topicId}>
            <InputLabel>Tipo</InputLabel>
            <Select
              value={mediaTypeFilter}
              label="Tipo"
              onChange={(event) => setMediaTypeFilter(event.target.value)}
            >
              <MenuItem value="">
                <em>Todos los tipos</em>
              </MenuItem>
              {Object.entries(MEDIA_TYPE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 160 } }} disabled={!topicId}>
            <InputLabel>Ordenar por</InputLabel>
            <Select
              value={sortField}
              label="Ordenar por"
              onChange={(event) => setSortField(event.target.value)}
            >
              <MenuItem value="title">Titulo</MenuItem>
              <MenuItem value="author">Autor</MenuItem>
              <MenuItem value="media_type">Tipo</MenuItem>
              <MenuItem value="created_at">Fecha de subida</MenuItem>
            </Select>
          </FormControl>

          <Tooltip title={sortDirection === 'asc' ? 'Ascendente' : 'Descendente'}>
            <IconButton
              onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              size="small"
              disabled={!topicId}
              sx={{ border: 1, borderColor: 'divider', alignSelf: { xs: 'flex-start', md: 'center' } }}
            >
              {sortDirection === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {loading
              ? 'Cargando contenidos...'
              : `${totalCount} contenido(s) disponible(s) - ${selectedIds.length} seleccionado(s)`}
            {loading && (
              <CircularProgress size={14} sx={{ ml: 1, verticalAlign: 'middle' }} />
            )}
          </Typography>
          {selectedItems.length > 0 && (
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {selectedItems.slice(0, 4).map((item) => (
                <Chip key={item.id} size="small" label={item.title} onDelete={() => handleToggle(item)} />
              ))}
              {selectedItems.length > 4 && (
                <Chip size="small" label={`+${selectedItems.length - 4} mas`} variant="outlined" />
              )}
            </Stack>
          )}
        </Stack>

        {error && (
          <Typography color="error" variant="body2">
            {error}{' '}
            <MuiLink component="button" type="button" onClick={loadPage} underline="hover">
              Reintentar
            </MuiLink>
          </Typography>
        )}

        <TableContainer sx={{ maxHeight: 360, border: 1, borderColor: 'divider' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected}
                    onChange={handleSelectVisible}
                    disabled={loading || items.length === 0}
                  />
                </TableCell>
                <TableCell>Titulo</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Autor</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Ver</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    Cargando contenidos...
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {items.map((item) => {
                    const selected = selectedSet.has(item.id);
                    return (
                      <TableRow
                        key={item.id}
                        hover
                        onClick={() => handleToggle(item)}
                        selected={selected}
                        sx={{ cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox checked={selected} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={selected ? 700 : 400}>
                            {item.title}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color="primary"
                            variant="outlined"
                            label={MEDIA_TYPE_LABELS[item.mediaType] || item.mediaType}
                          />
                        </TableCell>
                        <TableCell>{item.author}</TableCell>
                        <TableCell>{item.createdAt ? formatDate(item.createdAt) : '-'}</TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <MuiLink
                            href={`/content/${item.contentId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, textDecoration: 'none' }}
                          >
                            Ver
                            <OpenInNewIcon fontSize="small" />
                          </MuiLink>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!loading && items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                        {searchDebounced || mediaTypeFilter
                          ? 'No se encontro contenido con los filtros aplicados.'
                          : 'Este tema todavia no tiene contenidos para adjuntar.'}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(_event, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[12, 25, 50, 100]}
          labelRowsPerPage="Por página"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}–${to} de ${count !== -1 ? count : `más de ${to}`}`
          }
        />
      </Stack>
    </Paper>
  );
};

export default TopicTimelineContentSelector;
