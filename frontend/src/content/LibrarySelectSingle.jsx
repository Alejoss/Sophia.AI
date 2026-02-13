import React, { useState, useEffect, useMemo } from 'react';
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
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import contentApi from '../api/contentApi';

const LibrarySelectSingle = ({
  isOpen,
  onClose,
  onSelect,
  title = 'Seleccionar contenido de tu biblioteca',
  description,
  filterFunction,
  compact = false,
  isLoading = false,
}) => {
  const [userContent, setUserContent] = useState([]);
  const [selectedContentProfile, setSelectedContentProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [collections, setCollections] = useState([]);

  useEffect(() => {
    const fetchUserContent = async () => {
      try {
        const data = await contentApi.getUserContent();
        if (filterFunction) {
          setUserContent(data.filter(filterFunction));
        } else {
          setUserContent(data);
        }
      } catch (err) {
        console.error('LibrarySelectSingle: Error fetching content:', err);
        setError('Error al obtener tu contenido');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      setSelectedContentProfile(null);
      setSearchQuery('');
      setSelectedCollectionId(null);
      setLoading(true);
      setError(null);
      fetchUserContent();
    }
  }, [isOpen, filterFunction]);

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

  const filteredContent = useMemo(() => {
    let filtered = [...userContent];

    if (selectedCollectionId !== null) {
      const collectionIdNum =
        typeof selectedCollectionId === 'string'
          ? parseInt(selectedCollectionId, 10)
          : selectedCollectionId;
      filtered = filtered.filter(
        (item) =>
          item.collection === collectionIdNum ||
          item.collection === selectedCollectionId
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((item) => {
        const titleText = (item.title || '').toLowerCase();
        const author = (item.author || '').toLowerCase();
        const mediaType = (item.content?.media_type || '').toLowerCase();
        return (
          titleText.includes(query) ||
          author.includes(query) ||
          mediaType.includes(query)
        );
      });
    }

    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aValue, bValue;
        if (sortField === 'title') {
          aValue = (a.title || 'Sin título').toLowerCase();
          bValue = (b.title || 'Sin título').toLowerCase();
        } else if (sortField === 'author') {
          aValue = (a.author || 'Desconocido').toLowerCase();
          bValue = (b.author || 'Desconocido').toLowerCase();
        } else {
          return 0;
        }
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [userContent, selectedCollectionId, searchQuery, sortField, sortDirection]);

  const handleRowClick = (contentProfile) => {
    setSelectedContentProfile(contentProfile);
  };

  const handleSortDirectionToggle = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
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
        <Typography variant={compact ? 'h6' : 'h6'} sx={{ mb: 1 }}>
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
          <InputLabel>Tipo / Colección</InputLabel>
          <Select
            value={selectedCollectionId || ''}
            label="Tipo / Colección"
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
        Contenido disponible ({filteredContent.length})
      </Typography>

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
            {filteredContent.map((content) => (
              <TableRow
                key={content.id}
                hover
                onClick={() => handleRowClick(content)}
                selected={selectedContentProfile?.id === content.id}
                sx={{
                  cursor: 'pointer',
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
            {filteredContent.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  {searchQuery || selectedCollectionId !== null
                    ? 'No se encontró contenido con los filtros aplicados'
                    : 'No hay contenido disponible'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );

  if (loading) {
    return (
      <Dialog open={isOpen} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">
              Cargando tu contenido...
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={isOpen} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Alert severity="error">{error}</Alert>
        </DialogContent>
      </Dialog>
    );
  }

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
