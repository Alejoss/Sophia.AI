import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Chip,
  Link as MuiLink,
  Divider,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TablePagination,
  CircularProgress,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import contentApi from '../api/contentApi';
import { formatDate } from '../utils/dateUtils';

const DEFAULT_PAGE_SIZE = 25;

const toIdKey = (value) => (value == null ? null : String(value));

const LibrarySelectMultiple = ({
  onCancel,
  onSave,
  onSelectionChange,
  title = 'Seleccionar contenido de la biblioteca',
  description,
  filterFunction,
  maxSelections,
  selectedIds = [],
  contextName = '',
  compact = false,
  confirmLabel = 'Elegir',
  confirmingLabel = 'Guardando...',
}) => {
  const filterRef = useRef(filterFunction);
  filterRef.current = filterFunction;

  const [userContent, setUserContent] = useState([]);
  const [selectedContentProfiles, setSelectedContentProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [collections, setCollections] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);

  const selectedIdSet = useRef(new Set(selectedIds.map(toIdKey).filter(Boolean)));
  // Keep a ref of selected profiles so save always has the latest list.
  const selectedProfilesRef = useRef(selectedContentProfiles);
  selectedProfilesRef.current = selectedContentProfiles;

  useEffect(() => {
    selectedIdSet.current = new Set(selectedIds.map(toIdKey).filter(Boolean));
  }, [selectedIds]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(searchQuery.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [searchDebounced, selectedCollectionId, rowsPerPage]);

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const data = await contentApi.getUserCollections();
        setCollections(data || []);
      } catch (err) {
        console.error('LibrarySelectMultiple: Error fetching collections:', err);
      }
    };
    fetchCollections();
  }, []);

  const loadLibraryPage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await contentApi.getUserContentWithDetails({
        page: page + 1,
        page_size: rowsPerPage,
        search: searchDebounced,
        collection: selectedCollectionId || undefined,
      });

      const results = Array.isArray(data?.results)
        ? data.results.filter((item) => {
          if (!item?.content) return false;
          if (filterRef.current && !filterRef.current(item)) return false;
          return true;
        })
        : [];

      setUserContent(results);
      setTotalCount(typeof data?.count === 'number' ? data.count : 0);

      // Hydrate selected profile objects for IDs already chosen (e.g. other pages / parent state).
      if (selectedIdSet.current.size > 0) {
        setSelectedContentProfiles((prev) => {
          const map = new Map(prev.map((profile) => [toIdKey(profile.id), profile]));
          results.forEach((item) => {
            const key = toIdKey(item.id);
            if (selectedIdSet.current.has(key) && !map.has(key)) {
              map.set(key, item);
            }
          });
          return [...map.values()];
        });
      }
    } catch (err) {
      console.error('LibrarySelectMultiple: Error fetching content:', err);
      setError(err.message || 'Error al obtener tu contenido');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchDebounced, selectedCollectionId]);

  useEffect(() => {
    loadLibraryPage();
  }, [loadLibraryPage]);

  const isSelected = (profileId) => {
    const key = toIdKey(profileId);
    return selectedContentProfiles.some((profile) => toIdKey(profile.id) === key)
      || selectedIdSet.current.has(key);
  };

  const emitSelection = (nextSelection) => {
    selectedProfilesRef.current = nextSelection;
    selectedIdSet.current = new Set(nextSelection.map((profile) => toIdKey(profile.id)));
    setSelectedContentProfiles(nextSelection);
    if (onSelectionChange) onSelectionChange(nextSelection);
  };

  const handleContentToggle = (contentProfile) => {
    const key = toIdKey(contentProfile.id);
    const currentlySelected = isSelected(contentProfile.id);
    let nextSelection;
    if (currentlySelected) {
      nextSelection = selectedProfilesRef.current.filter(
        (profile) => toIdKey(profile.id) !== key,
      );
    } else if (maxSelections === 1) {
      nextSelection = [contentProfile];
    } else if (!maxSelections || selectedProfilesRef.current.length < maxSelections) {
      const map = new Map(
        selectedProfilesRef.current.map((profile) => [toIdKey(profile.id), profile]),
      );
      map.set(key, contentProfile);
      nextSelection = [...map.values()];
    } else {
      return;
    }
    emitSelection(nextSelection);
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const map = new Map(
        selectedProfilesRef.current.map((profile) => [toIdKey(profile.id), profile]),
      );
      userContent.forEach((item) => {
        if (!maxSelections || map.size < maxSelections) {
          map.set(toIdKey(item.id), item);
        }
      });
      emitSelection([...map.values()]);
      return;
    }
    const pageIds = new Set(userContent.map((item) => toIdKey(item.id)));
    emitSelection(
      selectedProfilesRef.current.filter((profile) => !pageIds.has(toIdKey(profile.id))),
    );
  };

  const handleSubmit = async () => {
    const profiles = selectedProfilesRef.current;
    const ids = profiles.map((profile) => profile.id).filter((id) => id != null);
    if (ids.length === 0) {
      setError('Selecciona al menos un contenido.');
      return;
    }
    // Ensure parent has the full profile objects before closing.
    if (onSelectionChange) onSelectionChange(profiles);
    setSaving(true);
    try {
      await onSave(ids, profiles);
    } catch (err) {
      console.error('LibrarySelectMultiple.handleSubmit - Error:', err);
      setError('Error al guardar las selecciones');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = selectedContentProfiles.length;
  const pageSelectedCount = userContent.filter((item) => isSelected(item.id)).length;

  return (
    <Box sx={{ pt: compact ? 0 : 12, px: compact ? 0 : 3, maxWidth: compact ? '100%' : 1200, mx: compact ? 0 : 'auto' }}>
      <Paper sx={{ p: compact ? 2 : 3 }}>
        <Box sx={{ mb: compact ? 1 : 3 }}>
          <Typography variant={compact ? 'h6' : 'h4'} sx={{ mb: 1 }}>
            {title} {contextName && `: ${contextName}`}
          </Typography>
          {description && (
            <Typography variant="body1" color="text.secondary">
              {description}
            </Typography>
          )}
          {maxSelections && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Se pueden seleccionar máximo {maxSelections} elementos
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: compact ? 1.5 : 3 }} />

        <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            placeholder="Buscar contenido..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ flexGrow: 1, minWidth: 200 }}
          />

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Colección</InputLabel>
            <Select
              value={selectedCollectionId}
              label="Colección"
              onChange={(e) => setSelectedCollectionId(e.target.value)}
            >
              <MenuItem value="">
                <em>Todas las colecciones</em>
              </MenuItem>
              {collections.map((collection) => (
                <MenuItem key={collection.id} value={String(collection.id)}>
                  {collection.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6">
            Contenido disponible
            {typeof totalCount === 'number' ? ` (${totalCount})` : ''}
            {selectedCount > 0 ? ` · ${selectedCount} seleccionado(s)` : ''}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" onClick={onCancel} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit}
              disabled={selectedCount === 0 || saving}
            >
              {saving ? confirmingLabel : `${confirmLabel} (${selectedCount})`}
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading && userContent.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            <TableContainer sx={{ maxHeight: compact ? 420 : 560, opacity: loading ? 0.6 : 1 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={
                          pageSelectedCount > 0 && pageSelectedCount < userContent.length
                        }
                        checked={userContent.length > 0 && pageSelectedCount === userContent.length}
                        onChange={handleSelectAll}
                        disabled={Boolean(maxSelections && selectedCount >= maxSelections && pageSelectedCount === 0)}
                      />
                    </TableCell>
                    <TableCell>Título</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Autor</TableCell>
                    <TableCell>Fecha de subida</TableCell>
                    <TableCell>Ver</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userContent.map((content) => {
                    const checked = isSelected(content.id);
                    return (
                      <TableRow
                        key={content.id}
                        hover
                        onClick={() => handleContentToggle(content)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={checked}
                            disabled={Boolean(
                              maxSelections
                              && selectedCount >= maxSelections
                              && !checked,
                            )}
                          />
                        </TableCell>
                        <TableCell>{content.title || 'Sin título'}</TableCell>
                        <TableCell>
                          <Chip
                            label={content.content?.media_type || '-'}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{content.author || 'Desconocido'}</TableCell>
                        <TableCell>
                          {content.created_at ? formatDate(content.created_at) : '—'}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <MuiLink
                            href={`/content/${content.content?.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              color: 'primary.main',
                              textDecoration: 'none',
                              '&:hover': { textDecoration: 'underline' },
                            }}
                          >
                            Ver
                            <OpenInNewIcon fontSize="small" />
                          </MuiLink>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {userContent.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        {searchDebounced || selectedCollectionId
                          ? 'No se encontró contenido con los filtros aplicados'
                          : 'No hay contenido disponible'}
                      </TableCell>
                    </TableRow>
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
              rowsPerPageOptions={[10, 25, 50]}
              labelRowsPerPage="Filas"
              labelDisplayedRows={({ from, to, count }) => (
                `${from}–${to} de ${count !== -1 ? count : `más de ${to}`}`
              )}
            />
          </>
        )}
      </Paper>
    </Box>
  );
};

export default LibrarySelectMultiple;
