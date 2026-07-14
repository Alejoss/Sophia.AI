import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Container,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  CircularProgress,
  Alert,
  Stack,
  Link as MuiLink,
  Paper,
} from '@mui/material';
import generalApi from '../api/generalApi';
import contentApi from '../api/contentApi';
import { AuthContext } from '../context/AuthContext';
import ContentDisplay from '../content/ContentDisplay';

import TopicIcon from '@mui/icons-material/Label';
import KnowledgePathIcon from '@mui/icons-material/AccountTree';

const searchSchema = yup.object({
  query: yup
    .string()
    .trim()
    .required('Escribe algo para buscar.'),
  searchType: yup
    .string()
    .oneOf(['all', 'content', 'topics', 'knowledge_paths'])
    .default('all'),
});

const MainSearch = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalResults: 0,
  });
  const [publicCollections, setPublicCollections] = useState([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState(null);
  const navigate = useNavigate();
  const { authState } = useContext(AuthContext);
  const isAuthenticated = authState.isAuthenticated;

  const {
    register,
    handleSubmit,
    control,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(searchSchema),
    defaultValues: { query: '', searchType: 'all' },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setPublicCollections([]);
      setPublicLoading(false);
      setPublicError(null);
      return;
    }
    let cancelled = false;
    const loadPublic = async () => {
      setPublicLoading(true);
      setPublicError(null);
      try {
        const data = await contentApi.getPublicCollections({ page: 1, page_size: 12 });
        if (!cancelled) {
          setPublicCollections(Array.isArray(data?.results) ? data.results : []);
        }
      } catch (err) {
        if (!cancelled) {
          setPublicError(
            err.response?.data?.error || err.message || 'No se pudieron cargar las colecciones',
          );
          setPublicCollections([]);
        }
      } finally {
        if (!cancelled) setPublicLoading(false);
      }
    };
    loadPublic();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const runSearch = async (query, searchType, page = 1) => {
    setIsLoading(true);
    setSearchError(null);
    setHasSearched(true);
    setLastSubmittedQuery(query);

    try {
      const response = await generalApi.search(query, searchType, page);
      setSearchResults(response.results);
      setPagination({
        currentPage: response.current_page,
        totalPages: response.total_pages,
        totalResults: response.count,
      });
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setSearchError('No se pudo completar la búsqueda. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async ({ query, searchType }) => {
    await runSearch(query.trim(), searchType, 1);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    const { query, searchType } = getValues();
    if (!query?.trim()) return;
    runSearch(query.trim(), searchType, newPage);
  };

  const handleResultClick = (result) => {
    let url;

    if (result.type === 'content') {
      if (result.source === 'profile' && result.profile_id) {
        url = `/content/search/${result.content.id}?profile=${result.profile_id}`;
      } else {
        url = `/content/search/${result.content.id}`;
      }
    } else if (result.type === 'topic') {
      url = `/content/topics/${result.id}`;
    } else if (result.type === 'knowledge_path') {
      url = `/knowledge_path/${result.id}`;
    }

    if (url) {
      navigate(url, { state: { searchQuery: lastSubmittedQuery } });
    }
  };

  const getResultTypeIcon = (type) => {
    if (type === 'topic') {
      return <TopicIcon sx={{ fontSize: 18 }} />;
    }
    if (type === 'knowledge_path') {
      return <KnowledgePathIcon sx={{ fontSize: 18 }} />;
    }
    return null;
  };

  const renderResultItem = (result) => {
    if (result.type === 'content') {
      return (
        <Box component="li" key={result.id} sx={{ listStyle: 'none' }}>
          <ContentDisplay
            content={result}
            variant="simple"
            onClick={() => handleResultClick(result)}
            showActions={false}
          />
        </Box>
      );
    }

    return (
      <Paper
        component="li"
        key={result.id}
        variant="outlined"
        onClick={() => handleResultClick(result)}
        sx={{ listStyle: 'none', p: 2, cursor: 'pointer', '&:hover': { boxShadow: 2 } }}
      >
        <Box sx={{ mb: 1 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1,
              py: 0.5,
              borderRadius: 1,
              bgcolor: 'action.hover',
            }}
          >
            {getResultTypeIcon(result.type)}
            <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
              {result.type}
            </Typography>
          </Box>
        </Box>

        <Typography variant="h6" sx={{ mb: 0.5 }}>
          {result.title}
        </Typography>

        {result.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {result.description}
          </Typography>
        )}

        <Button size="small" variant="outlined">
          Ver Detalles
        </Button>
      </Paper>
    );
  };

  const busy = isLoading || isSubmitting;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 2 }}>
        Buscar
      </Typography>

      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
          <TextField
            {...register('query')}
            placeholder="Buscar contenido, temas, caminos de conocimiento o personas..."
            fullWidth
            error={!!errors.query}
            helperText={errors.query?.message}
          />
          <Button type="submit" variant="contained" disabled={busy} sx={{ flexShrink: 0 }}>
            {busy ? 'Buscando...' : 'Buscar'}
          </Button>
        </Stack>

        <Controller
          name="searchType"
          control={control}
          render={({ field }) => (
            <RadioGroup row {...field} sx={{ mt: 1 }}>
              <FormControlLabel value="all" control={<Radio size="small" />} label="Todo" />
              <FormControlLabel value="content" control={<Radio size="small" />} label="Contenido" />
              <FormControlLabel value="topics" control={<Radio size="small" />} label="Temas" />
              <FormControlLabel
                value="knowledge_paths"
                control={<Radio size="small" />}
                label="Caminos de Conocimiento"
              />
            </RadioGroup>
          )}
        />
      </Box>

      <Box component="section" aria-labelledby="search-collections-heading" sx={{ mb: 3 }}>
        <Typography id="search-collections-heading" variant="h6">
          Biblioteca Compartida
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Colecciones públicas de la comunidad
        </Typography>
        {!isAuthenticated && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            <MuiLink component={Link} to="/profiles/login" underline="hover">
              Inicia sesión
            </MuiLink>{' '}
            para ver colecciones públicas.
          </Typography>
        )}
        {isAuthenticated && publicLoading && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            Cargando colecciones…
          </Typography>
        )}
        {isAuthenticated && publicError && !publicLoading && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {publicError}
          </Alert>
        )}
        {isAuthenticated && !publicLoading && !publicError && publicCollections.length === 0 && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            Aún no hay colecciones públicas con contenido visible.
          </Typography>
        )}
        {isAuthenticated && !publicLoading && publicCollections.length > 0 && (
          <Box
            sx={{
              mt: 1.5,
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            }}
          >
            {publicCollections.map((c) => (
              <Card
                key={c.id}
                variant="outlined"
                sx={{
                  bgcolor: 'background.paper',
                  borderColor: 'divider',
                }}
              >
                <CardActionArea
                  onClick={() =>
                    navigate(`/content/collections/${c.id}`, { state: { from: '/search' } })
                  }
                >
                  <CardContent sx={{ py: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom component="div">
                      {c.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Por {c.owner_username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      {c.visible_item_count}{' '}
                      {c.visible_item_count === 1 ? 'elemento visible' : 'elementos visibles'}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        )}
      </Box>

      {searchError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {searchError}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <Stack alignItems="center" spacing={1.5}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Cargando resultados...
            </Typography>
          </Stack>
        </Box>
      ) : (
        <Box>
          {searchResults.length > 0 ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Mostrando {searchResults.length} de {pagination.totalResults} resultados
              </Typography>
              <Stack component="ul" spacing={2} sx={{ pl: 0, m: 0 }}>
                {searchResults.map(renderResultItem)}
              </Stack>

              {pagination.totalPages > 1 && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 2,
                    mt: 4,
                  }}
                >
                  <Button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={pagination.currentPage === 1}
                    variant="contained"
                    color={pagination.currentPage > 1 ? 'primary' : 'inherit'}
                    sx={{
                      bgcolor: pagination.currentPage > 1 ? 'primary.main' : 'grey.300',
                      color: pagination.currentPage > 1 ? 'white' : 'text.disabled',
                      textTransform: 'none',
                      '&:disabled': {
                        bgcolor: 'grey.300',
                        color: 'text.disabled',
                      },
                    }}
                  >
                    Anterior
                  </Button>

                  <Typography variant="body2" color="text.secondary">
                    Página {pagination.currentPage} de {pagination.totalPages}
                  </Typography>

                  <Button
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={pagination.currentPage === pagination.totalPages}
                    variant="contained"
                    color={pagination.currentPage < pagination.totalPages ? 'primary' : 'inherit'}
                    sx={{
                      bgcolor:
                        pagination.currentPage < pagination.totalPages ? 'primary.main' : 'grey.300',
                      color:
                        pagination.currentPage < pagination.totalPages ? 'white' : 'text.disabled',
                      textTransform: 'none',
                      '&:disabled': {
                        bgcolor: 'grey.300',
                        color: 'text.disabled',
                      },
                    }}
                  >
                    Siguiente
                  </Button>
                </Box>
              )}
            </>
          ) : (
            hasSearched &&
            !searchError && (
              <Alert severity="info">
                No se encontraron resultados para &quot;{lastSubmittedQuery}&quot;
              </Alert>
            )
          )}
        </Box>
      )}
    </Container>
  );
};

export default MainSearch;
