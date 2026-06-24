import React, { useMemo, useState } from 'react';
import {
  Box,
  Checkbox,
  Chip,
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
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import { formatDate } from '../../utils/dateUtils';

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

const getItemTitle = (item) => {
  const content = getContentData(item);
  return (
    item?.title ||
    item?.selected_profile?.title ||
    content?.original_title ||
    'Contenido sin titulo'
  );
};

const getItemAuthor = (item) => {
  const content = getContentData(item);
  return item?.author || item?.selected_profile?.author || content?.original_author || 'Desconocido';
};

const getItemMediaType = (item) => {
  const content = getContentData(item);
  return (content?.media_type || item?.media_type || 'TEXT').toUpperCase();
};

const getItemCreatedAt = (item) => {
  const content = getContentData(item);
  return item?.created_at || content?.created_at || item?.selected_profile?.created_at || null;
};

const normalizeItems = (items = []) => (
  items
    .map((item) => ({
      id: getItemId(item),
      title: getItemTitle(item),
      author: getItemAuthor(item),
      mediaType: getItemMediaType(item),
      createdAt: getItemCreatedAt(item),
      contentId: getItemId(item),
    }))
    .filter((item) => item.id)
);

const TopicTimelineContentSelector = ({
  items = [],
  selectedIds = [],
  loading = false,
  onSelectionChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState('');
  const [sortField, setSortField] = useState('title');
  const [sortDirection, setSortDirection] = useState('asc');

  const normalizedItems = useMemo(() => normalizeItems(items), [items]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = normalizedItems.filter((item) => {
      const matchesMedia = !mediaTypeFilter || item.mediaType === mediaTypeFilter;
      const matchesSearch = !query ||
        item.title.toLowerCase().includes(query) ||
        item.author.toLowerCase().includes(query) ||
        (MEDIA_TYPE_LABELS[item.mediaType] || item.mediaType).toLowerCase().includes(query);
      return matchesMedia && matchesSearch;
    });

    result = [...result].sort((a, b) => {
      let aValue = '';
      let bValue = '';
      if (sortField === 'author') {
        aValue = a.author.toLowerCase();
        bValue = b.author.toLowerCase();
      } else if (sortField === 'mediaType') {
        aValue = MEDIA_TYPE_LABELS[a.mediaType] || a.mediaType;
        bValue = MEDIA_TYPE_LABELS[b.mediaType] || b.mediaType;
      } else if (sortField === 'createdAt') {
        aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      } else {
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [mediaTypeFilter, normalizedItems, searchQuery, sortDirection, sortField]);

  const selectedItems = useMemo(
    () => normalizedItems.filter((item) => selectedSet.has(item.id)),
    [normalizedItems, selectedSet],
  );

  const setSelectedIds = (nextIds) => {
    onSelectionChange([...new Set(nextIds)]);
  };

  const handleToggle = (itemId) => {
    if (selectedSet.has(itemId)) {
      setSelectedIds(selectedIds.filter((id) => id !== itemId));
    } else {
      setSelectedIds([...selectedIds, itemId]);
    }
  };

  const handleSelectVisible = (event) => {
    const visibleIds = filteredItems.map((item) => item.id);
    if (event.target.checked) {
      setSelectedIds([...selectedIds, ...visibleIds]);
    } else {
      setSelectedIds(selectedIds.filter((id) => !visibleIds.includes(id)));
    }
  };

  const visibleSelectedCount = filteredItems.filter((item) => selectedSet.has(item.id)).length;
  const allVisibleSelected = filteredItems.length > 0 && visibleSelectedCount === filteredItems.length;
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
            disabled={loading}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ flexGrow: 1, minWidth: { md: 240 } }}
          />

          <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 160 } }} disabled={loading}>
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

          <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 160 } }} disabled={loading}>
            <InputLabel>Ordenar por</InputLabel>
            <Select
              value={sortField}
              label="Ordenar por"
              onChange={(event) => setSortField(event.target.value)}
            >
              <MenuItem value="title">Titulo</MenuItem>
              <MenuItem value="author">Autor</MenuItem>
              <MenuItem value="mediaType">Tipo</MenuItem>
              <MenuItem value="createdAt">Fecha de subida</MenuItem>
            </Select>
          </FormControl>

          <Tooltip title={sortDirection === 'asc' ? 'Ascendente' : 'Descendente'}>
            <IconButton
              onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              size="small"
              disabled={loading}
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
              : `${filteredItems.length} contenido(s) disponible(s) - ${selectedIds.length} seleccionado(s)`}
          </Typography>
          {selectedItems.length > 0 && (
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {selectedItems.slice(0, 4).map((item) => (
                <Chip key={item.id} size="small" label={item.title} onDelete={() => handleToggle(item.id)} />
              ))}
              {selectedItems.length > 4 && (
                <Chip size="small" label={`+${selectedItems.length - 4} mas`} variant="outlined" />
              )}
            </Stack>
          )}
        </Stack>

        <TableContainer sx={{ maxHeight: 360, border: 1, borderColor: 'divider' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected}
                    onChange={handleSelectVisible}
                    disabled={loading || filteredItems.length === 0}
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
              {filteredItems.map((item) => {
                const selected = selectedSet.has(item.id);
                return (
                  <TableRow
                    key={item.id}
                    hover
                    onClick={() => handleToggle(item.id)}
                    selected={selected}
                    sx={{ cursor: 'pointer' }}
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
              {!loading && filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    {normalizedItems.length === 0
                      ? 'Este tema todavia no tiene contenidos para adjuntar.'
                      : 'No se encontro contenido con los filtros aplicados.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Paper>
  );
};

export default TopicTimelineContentSelector;
