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
import { useTranslation } from 'react-i18next';
import { useDateLocales } from '../../hooks/useDateLocales';

const getContentData = (item) => item?.content || item;

const getItemId = (item) => {
  const content = getContentData(item);
  return content?.id != null ? String(content.id) : null;
};

const getItemTitle = (item, untitled) => {
  const content = getContentData(item);
  return (
    item?.title ||
    item?.selected_profile?.title ||
    content?.original_title ||
    untitled
  );
};

const getItemAuthor = (item, unknown) => {
  const content = getContentData(item);
  return item?.author || item?.selected_profile?.author || content?.original_author || unknown;
};

const getItemMediaType = (item) => {
  const content = getContentData(item);
  return (content?.media_type || item?.media_type || 'TEXT').toUpperCase();
};

const getItemCreatedAt = (item) => {
  const content = getContentData(item);
  return item?.created_at || content?.created_at || item?.selected_profile?.created_at || null;
};

const normalizeItems = (items = [], untitled, unknown) => (
  items
    .map((item) => ({
      id: getItemId(item),
      title: getItemTitle(item, untitled),
      author: getItemAuthor(item, unknown),
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
  const { t } = useTranslation('topics');
  const { intl } = useDateLocales();
  const mediaTypeLabels = useMemo(() => ({
    VIDEO: t('chat.video'),
    AUDIO: t('chat.audio'),
    IMAGE: t('timeline.image'),
    TEXT: t('chat.text'),
  }), [t]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState('');
  const [sortField, setSortField] = useState('title');
  const [sortDirection, setSortDirection] = useState('asc');

  const normalizedItems = useMemo(
    () => normalizeItems(items, t('timeline.untitledContent'), t('addContent.unknownAuthor')),
    [items, t],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = normalizedItems.filter((item) => {
      const matchesMedia = !mediaTypeFilter || item.mediaType === mediaTypeFilter;
      const matchesSearch = !query ||
        item.title.toLowerCase().includes(query) ||
        item.author.toLowerCase().includes(query) ||
        (mediaTypeLabels[item.mediaType] || item.mediaType).toLowerCase().includes(query);
      return matchesMedia && matchesSearch;
    });

    result = [...result].sort((a, b) => {
      let aValue = '';
      let bValue = '';
      if (sortField === 'author') {
        aValue = a.author.toLowerCase();
        bValue = b.author.toLowerCase();
      } else if (sortField === 'mediaType') {
        aValue = mediaTypeLabels[a.mediaType] || a.mediaType;
        bValue = mediaTypeLabels[b.mediaType] || b.mediaType;
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
  }, [mediaTypeFilter, mediaTypeLabels, normalizedItems, searchQuery, sortDirection, sortField]);

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
            {t('timeline.topicContents')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('timeline.selectTopicHelp')}
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
          <TextField
            placeholder={t('timeline.searchPlaceholder')}
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
            <InputLabel>{t('common.type')}</InputLabel>
            <Select
              value={mediaTypeFilter}
              label={t('common.type')}
              onChange={(event) => setMediaTypeFilter(event.target.value)}
            >
              <MenuItem value="">
                <em>{t('timeline.allTypes')}</em>
              </MenuItem>
              {Object.entries(mediaTypeLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 160 } }} disabled={loading}>
            <InputLabel>{t('timeline.sortBy')}</InputLabel>
            <Select
              value={sortField}
              label={t('timeline.sortBy')}
              onChange={(event) => setSortField(event.target.value)}
            >
              <MenuItem value="title">{t('edit.titleLabel')}</MenuItem>
              <MenuItem value="author">{t('addContent.author')}</MenuItem>
              <MenuItem value="mediaType">{t('common.type')}</MenuItem>
              <MenuItem value="createdAt">{t('timeline.uploadedAt')}</MenuItem>
            </Select>
          </FormControl>

          <Tooltip title={sortDirection === 'asc' ? t('timeline.ascending') : t('timeline.descending')}>
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
              ? t('timeline.loadingContents')
              : t('timeline.available', { count: filteredItems.length, selected: selectedIds.length })}
          </Typography>
          {selectedItems.length > 0 && (
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {selectedItems.slice(0, 4).map((item) => (
                <Chip key={item.id} size="small" label={item.title} onDelete={() => handleToggle(item.id)} />
              ))}
              {selectedItems.length > 4 && (
                <Chip size="small" label={t('timeline.more', { count: selectedItems.length - 4 })} variant="outlined" />
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
                <TableCell>{t('edit.titleLabel')}</TableCell>
                <TableCell>{t('common.type')}</TableCell>
                <TableCell>{t('addContent.author')}</TableCell>
                <TableCell>{t('suggestion.date')}</TableCell>
                <TableCell>{t('common.view')}</TableCell>
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
                        label={mediaTypeLabels[item.mediaType] || item.mediaType}
                      />
                    </TableCell>
                    <TableCell>{item.author}</TableCell>
                    <TableCell>{item.createdAt ? new Date(item.createdAt).toLocaleDateString(intl, { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <MuiLink
                        href={`/content/${item.contentId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, textDecoration: 'none' }}
                      >
                        {t('common.view')}
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
                      ? t('timeline.emptyAttach')
                      : t('timeline.noFilterMatch')}
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
