import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import contentApi from '../api/contentApi';

const FeaturedBooksAdmin = () => {
  const [featured, setFeatured] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadFeatured = useCallback(async () => {
    setLoadingFeatured(true);
    setError(null);
    try {
      const data = await contentApi.getAdminFeaturedBooks();
      setFeatured(Array.isArray(data?.results) ? data.results : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudieron cargar los destacados');
      setFeatured([]);
    } finally {
      setLoadingFeatured(false);
    }
  }, []);

  const loadCandidates = useCallback(async (query) => {
    setLoadingCandidates(true);
    setError(null);
    try {
      const data = await contentApi.getAdminFeaturedBookCandidates({
        search: query || undefined,
        available: true,
        page: 1,
        page_size: 12,
      });
      setCandidates(Array.isArray(data?.results) ? data.results : []);
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || 'No se pudieron buscar candidatos',
      );
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  useEffect(() => {
    loadFeatured();
    loadCandidates('');
  }, [loadFeatured, loadCandidates]);

  const handleSearch = async (event) => {
    event.preventDefault();
    const q = searchInput.trim();
    setSearch(q);
    await loadCandidates(q);
  };

  const handleAdd = async (profileId) => {
    setBusyId(profileId);
    setError(null);
    try {
      await contentApi.addAdminFeaturedBook(profileId);
      await Promise.all([loadFeatured(), loadCandidates(search)]);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo destacar el libro');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (profileId) => {
    setBusyId(profileId);
    setError(null);
    try {
      await contentApi.removeAdminFeaturedBook(profileId);
      await Promise.all([loadFeatured(), loadCandidates(search)]);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo quitar el destacado');
    } finally {
      setBusyId(null);
    }
  };

  const handleMove = async (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= featured.length) return;
    const next = [...featured];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    setFeatured(next);
    setBusyId(item.id);
    setError(null);
    try {
      const data = await contentApi.reorderAdminFeaturedBooks(next.map((row) => row.id));
      setFeatured(Array.isArray(data?.results) ? data.results : next);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo reordenar');
      await loadFeatured();
    } finally {
      setBusyId(null);
    }
  };

  const renderBookRow = (item, { actions }) => {
    const cover = item.thumbnail_preview || item.thumbnail;
    const title = item.title || 'Sin título';
    return (
      <Card key={item.id} variant="outlined" sx={{ mb: 1.5 }}>
        <CardContent
          sx={{
            display: 'flex',
            gap: 1.5,
            alignItems: 'center',
            py: 1.5,
            '&:last-child': { pb: 1.5 },
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 72,
              flexShrink: 0,
              bgcolor: 'grey.100',
              borderRadius: 0.5,
              overflow: 'hidden',
            }}
          >
            {cover ? (
              <Box
                component="img"
                src={cover}
                alt={title}
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : null}
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {item.author ? `Por ${item.author}` : 'Sin autor'}
              {item.collection_name ? ` · ${item.collection_name}` : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {actions}
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ mb: 5 }}>
      <Typography variant="h5" gutterBottom>
        Libros destacados (Buscar)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Elige qué libros con portada aparecen en la página Buscar. Solo puedes seleccionar
        textos visibles en colecciones públicas que tengan miniatura.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        Destacados actuales ({featured.length})
      </Typography>
      {loadingFeatured ? (
        <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : featured.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Aún no hay libros destacados. Busca abajo para añadir algunos.
        </Typography>
      ) : (
        <Box sx={{ mb: 3 }}>
          {featured.map((item, index) =>
            renderBookRow(item, {
              actions: (
                <>
                  <IconButton
                    size="small"
                    aria-label="Subir"
                    disabled={busyId === item.id || index === 0}
                    onClick={() => handleMove(index, -1)}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Bajar"
                    disabled={busyId === item.id || index === featured.length - 1}
                    onClick={() => handleMove(index, 1)}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Quitar de destacados"
                    color="error"
                    disabled={busyId === item.id}
                    onClick={() => handleRemove(item.id)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </>
              ),
            }),
          )}
        </Box>
      )}

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        Añadir libros elegibles
      </Typography>
      <Box
        component="form"
        onSubmit={handleSearch}
        sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}
      >
        <TextField
          size="small"
          placeholder="Buscar por título, autor o colección…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ flexGrow: 1, minWidth: 220 }}
        />
        <Button type="submit" variant="outlined" startIcon={<SearchIcon />} disabled={loadingCandidates}>
          Buscar
        </Button>
      </Box>

      {loadingCandidates ? (
        <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : candidates.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No hay candidatos disponibles con esos filtros.
        </Typography>
      ) : (
        candidates.map((item) =>
          renderBookRow(item, {
            actions: (
              <Button
                size="small"
                variant="contained"
                disabled={busyId === item.id}
                onClick={() => handleAdd(item.id)}
                sx={{ textTransform: 'none' }}
              >
                Destacar
              </Button>
            ),
          }),
        )
      )}
    </Box>
  );
};

export default FeaturedBooksAdmin;
