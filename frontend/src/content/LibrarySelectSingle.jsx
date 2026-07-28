import React, { useState, useEffect, useCallback } from 'react';
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
  Chip,
  Link as MuiLink,
  Divider,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TablePagination,
  CircularProgress,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import contentApi from '../api/contentApi';

const DEFAULT_PAGE_SIZE = 25;

const LibrarySelectSingle = ({
  isOpen,
  onClose,
  onSelect,
  title = 'Seleccionar contenido de tu biblioteca',
  description,
  filterFunction,
  excludeTopicId = null,
  excludeCollectionId = null,
  compact = false,
  isLoading = false,
}) => {
  const [userContent, setUserContent] = useState([]);
  const [selectedContentProfile, setSelectedContentProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [collections, setCollections] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(searchQuery.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [searchDebounced, selectedCollectionId, sortField, sortDirection, excludeTopicId, excludeCollectionId]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedContentProfile(null);
    setSearchQuery('');
    setSearchDebounced('');
    setSelectedCollectionId(null);
    setSortField(null);
    setSortDirection('asc');
    setPage(0);
    setError(null);
  }, [isOpen]);

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const data = await contentApi.getUserCollections();
        setCollections(data || []);
      } catch (err) {
        console.error('LibrarySelectSingle: Error fetching collections:', err);
      }
    };
    if (isOpen) {
      fetchCollections();
    }
  }, [isOpen]);

  const ordering = (() => {
    if (!sortField) return '-created_at';
    return sortDirection === 'desc' ? `-${sortField}` : sortField;
  })();

  const loadLibraryPage = useCallback(async () => {
    if (!isOpen) return;
    try {
      setLoading(true);
      setError(null);
      const data = await contentApi.getUserContentWithDetails({
        page: page + 1,
        page_size: rowsPerPage,
        search: searchDebounced,
        collection: selectedCollectionId || undefined,
        exclude_topic: excludeTopicId || undefined,
        exclude_collection: excludeCollectionId || undefined,
        ordering,
      });
      let results = Array.isArray(data?.results) ? data.results : [];
      if (filterFunction) {
        results = results.filter(filterFunction);
      }
      setUserContent(results);
      setTotalCount(typeof data?.count === 'number' ? data.count : 0);
    } catch (err) {
      console.error('LibrarySelectSingle: Error fetching content:', err);
      setError('Error al obtener tu contenido');
      setUserContent([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [
    isOpen,
    page,
    rowsPerPage,
    searchDebounced,
    selectedCollectionId,
    excludeTopicId,
    excludeCollectionId,
    ordering,
    filterFunction,
  ]);

  useEffect(() => {
    loadLibraryPage();
  }, [loadLibraryPage]);

  const handleRowClick = (contentProfile) => {
    setSelectedContentProfile(contentProfile);
  };

  const handleSortDirectionToggle = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleChangePage = (_event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleConfirm = () => {
    if (selectedContentProfile) {
      onSelect(selectedContentProfile);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedContentProfile(null);
    onClose();
  };

  const contentBody = (
    <Paper
      sx={{
        p: compact ? 2 : 3,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
      elevation={0}
    >
      <Box sx={{ mb: compact ? 1.5 : 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Box
        sx={{
          mb: 2,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <TextField
          placeholder="Buscar contenido..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          InputProps={{
            startAdornment: (
              <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            ),
          }}
          sx={{ flexGrow: 1, minWidth: 180 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Colección</InputLabel>
          <Select
            value={selectedCollectionId || ''}
            label="Colección"
            onChange={(e) =>
              setSelectedCollectionId(e.target.value || null)
            }
          >
            <MenuItem value="">
              <em>Todas las colecciones</em>
            </MenuItem>
            {collections.map((collection) => (
              <MenuItem key={collection.id} value={collection.id}>
                {collection.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Ordenar por</InputLabel>
          <Select
            value={sortField || ''}
            label="Ordenar por"
            onChange={(e) => setSortField(e.target.value || null)}
          >
            <MenuItem value="">
              <em>Sin ordenar</em>
            </MenuItem>
            <MenuItem value="title">Título</MenuItem>
            <MenuItem value="author">Autor</MenuItem>
            <MenuItem value="created_at">Fecha de subida</MenuItem>
          </Select>
        </FormControl>
        {sortField && (
          <IconButton
            onClick={handleSortDirectionToggle}
            size="small"
            sx={{ border: 1, borderColor: 'divider' }}
            title={
              sortDirection === 'asc' ? 'Ascendente' : 'Descendente'
            }
          >
            {sortDirection === 'asc' ? (
              <ArrowUpwardIcon />
            ) : (
              <ArrowDownwardIcon />
            )}
          </IconButton>
        )}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Contenido disponible ({totalCount})
        {loading && (
          <CircularProgress size={14} sx={{ ml: 1, verticalAlign: 'middle' }} />
        )}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
          <Button size="small" onClick={loadLibraryPage} sx={{ ml: 1 }}>
            Reintentar
          </Button>
        </Alert>
      )}

      <TableContainer
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Título</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Autor</TableCell>
              <TableCell>Ver</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && userContent.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  Cargando tu contenido...
                </TableCell>
              </TableRow>
            ) : (
              <>
                {userContent.map((content) => (
                  <TableRow
                    key={content.id}
                    hover
                    onClick={() => handleRowClick(content)}
                    selected={selectedContentProfile?.id === content.id}
                    sx={{
                      cursor: 'pointer',
                      opacity: loading ? 0.6 : 1,
                      '&.Mui-selected': {
                        backgroundColor: 'action.selected',
                      },
                      '&.Mui-selected:hover': {
                        backgroundColor: 'action.selected',
                      },
                    }}
                  >
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
                ))}
                {userContent.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      {searchDebounced || selectedCollectionId !== null
                        ? 'No se encontró contenido con los filtros aplicados'
                        : 'No hay contenido disponible'}
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
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[12, 25, 50, 100]}
        labelRowsPerPage="Por página"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}–${to} de ${count !== -1 ? count : `más de ${to}`}`
        }
        sx={{ flexShrink: 0 }}
      />
    </Paper>
  );

  return (
    <Dialog
      open={isOpen}
      onClose={!isLoading ? handleClose : undefined}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ display: 'none' }}>{title}</DialogTitle>
      <DialogContent
        sx={{
          p: compact ? 2 : 3,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {contentBody}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
        {isLoading ? (
          <Typography variant="body2" color="text.secondary">
            Agregando contenido...
          </Typography>
        ) : (
          <>
            <Button onClick={handleClose} color="inherit">
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleConfirm}
              disabled={!selectedContentProfile}
            >
              Elegir
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default LibrarySelectSingle;
