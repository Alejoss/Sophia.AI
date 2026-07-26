import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import contentApi from '../api/contentApi';

const CANDIDATES_PAGE_SIZE = 36;

const coverSrc = (item) => item.thumbnail_preview || item.thumbnail;
const bookTitle = (item) => item.title || 'Sin título';

const CoverImage = ({ item }) => {
  const title = bookTitle(item);
  const cover = coverSrc(item);
  return (
    <Box
      sx={{
        aspectRatio: '2 / 3',
        bgcolor: 'grey.900',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {cover ? (
        <Box
          component="img"
          src={cover}
          alt={title}
          loading="lazy"
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ p: 1, textAlign: 'center' }}>
          Sin portada
        </Typography>
      )}
    </Box>
  );
};

const CoverCard = ({
  item,
  onClick,
  disabled,
  overlay,
  selected = false,
  clickable = true,
}) => {
  const title = bookTitle(item);
  return (
    <Tooltip title={title} arrow enterDelay={400}>
      <Card
        variant="outlined"
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderColor: selected ? 'primary.main' : 'divider',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        {clickable ? (
          <CardActionArea
            onClick={onClick}
            disabled={disabled}
            sx={{ display: 'block' }}
            aria-label={`Destacar ${title}`}
          >
            <CoverImage item={item} />
          </CardActionArea>
        ) : (
          <CoverImage item={item} />
        )}
        {overlay}
      </Card>
    </Tooltip>
  );
};

const FeaturedBooksAdmin = () => {
  const [featured, setFeatured] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
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

  const loadCandidates = useCallback(async (query, pageNum = 1) => {
    setLoadingCandidates(true);
    setError(null);
    try {
      const data = await contentApi.getAdminFeaturedBookCandidates({
        search: query || undefined,
        available: true,
        page: pageNum,
        page_size: CANDIDATES_PAGE_SIZE,
      });
      setCandidates(Array.isArray(data?.results) ? data.results : []);
      setPage(data?.current_page || pageNum);
      setTotalPages(data?.total_pages || 1);
      setTotalCount(data?.count || 0);
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || 'No se pudieron buscar candidatos',
      );
      setCandidates([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  useEffect(() => {
    loadFeatured();
    loadCandidates('', 1);
  }, [loadFeatured, loadCandidates]);

  const handleSearch = async (event) => {
    event.preventDefault();
    const q = searchInput.trim();
    setSearch(q);
    setPage(1);
    await loadCandidates(q, 1);
  };

  const handlePageChange = async (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    setPage(nextPage);
    await loadCandidates(search, nextPage);
  };

  const handleAdd = async (profileId) => {
    setBusyId(profileId);
    setError(null);
    try {
      await contentApi.addAdminFeaturedBook(profileId);
      await Promise.all([loadFeatured(), loadCandidates(search, page)]);
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
      await Promise.all([loadFeatured(), loadCandidates(search, page)]);
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

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Elige las portadas que aparecen en Buscar. Solo textos visibles en colecciones
        públicas con miniatura. Los elegibles están ordenados por título.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        Destacados actuales ({featured.length})
      </Typography>
      {loadingFeatured ? (
        <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : featured.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Aún no hay libros destacados. Elige portadas abajo.
        </Typography>
      ) : (
        <Box
          sx={{
            mb: 4,
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: {
              xs: 'repeat(3, minmax(0, 1fr))',
              sm: 'repeat(4, minmax(0, 1fr))',
              md: 'repeat(6, minmax(0, 1fr))',
              lg: 'repeat(8, minmax(0, 1fr))',
            },
          }}
        >
          {featured.map((item, index) => (
            <CoverCard
              key={item.id}
              item={item}
              selected
              clickable={false}
              disabled={busyId === item.id}
              overlay={
                <Stack
                  direction="row"
                  spacing={0.25}
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    bgcolor: 'rgba(0,0,0,0.55)',
                    borderRadius: 1,
                  }}
                >
                  <IconButton
                    size="small"
                    aria-label="Subir"
                    disabled={busyId === item.id || index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMove(index, -1);
                    }}
                    sx={{ color: 'common.white', p: 0.5 }}
                  >
                    <ArrowUpwardIcon fontSize="inherit" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Bajar"
                    disabled={busyId === item.id || index === featured.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMove(index, 1);
                    }}
                    sx={{ color: 'common.white', p: 0.5 }}
                  >
                    <ArrowDownwardIcon fontSize="inherit" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Quitar de destacados"
                    disabled={busyId === item.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(item.id);
                    }}
                    sx={{ color: 'error.light', p: 0.5 }}
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </Stack>
              }
            />
          ))}
        </Box>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        Libros elegibles
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
        <Button
          type="submit"
          variant="outlined"
          startIcon={<SearchIcon />}
          disabled={loadingCandidates}
        >
          Buscar
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {totalCount > 0
          ? `${totalCount.toLocaleString()} libros · página ${page} de ${totalPages}`
          : 'Sin resultados'}
        {' · clic en una portada para destacar'}
      </Typography>

      {loadingCandidates ? (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : candidates.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No hay candidatos disponibles con esos filtros.
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: {
              xs: 'repeat(3, minmax(0, 1fr))',
              sm: 'repeat(4, minmax(0, 1fr))',
              md: 'repeat(6, minmax(0, 1fr))',
              lg: 'repeat(8, minmax(0, 1fr))',
            },
          }}
        >
          {candidates.map((item) => (
            <CoverCard
              key={item.id}
              item={item}
              disabled={busyId === item.id}
              onClick={() => handleAdd(item.id)}
            />
          ))}
        </Box>
      )}

      {totalPages > 1 && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 2,
            mt: 3,
          }}
        >
          <Button
            variant="outlined"
            disabled={loadingCandidates || page <= 1}
            onClick={() => handlePageChange(page - 1)}
          >
            Anterior
          </Button>
          <Typography variant="body2">
            {page} / {totalPages}
          </Typography>
          <Button
            variant="outlined"
            disabled={loadingCandidates || page >= totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            Siguiente
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default FeaturedBooksAdmin;
