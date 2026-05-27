import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
} from '@mui/material';
import generalApi from '../api/generalApi';
import contentApi from '../api/contentApi';
import { AuthContext } from '../context/AuthContext';
import ContentDisplay from '../content/ContentDisplay';

// Import icons for different result types
import TopicIcon from '@mui/icons-material/Label';
import KnowledgePathIcon from '@mui/icons-material/AccountTree';

const MainSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchType, setSearchType] = useState('all'); // 'all', 'content', 'topics', 'knowledge_paths', 'people'
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalResults: 0
  });
  const [publicCollections, setPublicCollections] = useState([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState(null);
  const navigate = useNavigate();
  const { authState } = useContext(AuthContext);
  const isAuthenticated = authState.isAuthenticated;

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
            err.response?.data?.error || err.message || 'No se pudieron cargar las colecciones'
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

  const handleSearch = async (e, page = 1) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const response = await generalApi.search(searchQuery, searchType, page);
      
      // Update search results
      setSearchResults(response.results);
      
      // Update pagination info
      setPagination({
        currentPage: response.current_page,
        totalPages: response.total_pages,
        totalResults: response.count
      });
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      handleSearch(new Event('submit'), newPage);
    }
  };

  const handleResultClick = (result) => {
    // Construct URL based on result type and ID
    let url;
    
    if (result.type === 'content') {
      // If it's a content profile, include the profile ID in the URL
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
      // Pass the search query to the next component
      navigate(url, { state: { searchQuery } });
    }
  };

  // Get icon for result type
  const getResultTypeIcon = (type) => {
    if (type === 'topic') {
      return <TopicIcon sx={{ fontSize: 18 }} />;
    } else if (type === 'knowledge_path') {
      return <KnowledgePathIcon sx={{ fontSize: 18 }} />;
    } else {
      return null; // ContentDisplay will handle content icons
    }
  };

  // Render search result item
  const renderResultItem = (result) => {
    if (result.type === 'content') {
      // Use ContentDisplay for content results
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
    } else {
      // Render topics and knowledge paths with the original format
      return (
        <Paper
          component="li"
          key={result.id} 
          variant="outlined"
          onClick={() => handleResultClick(result)}
          sx={{ listStyle: 'none', p: 2, cursor: 'pointer', '&:hover': { boxShadow: 2 } }}
        >
          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, borderRadius: 1, bgcolor: 'action.hover' }}>
              {getResultTypeIcon(result.type)}
              <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
                {result.type}
              </Typography>
            </Box>
          </Box>
          
          <Typography variant="h6" sx={{ mb: 0.5 }}>{result.title}</Typography>
          
          {result.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {result.description}
            </Typography>
          )}
          
          <Button size="small" variant="outlined">Ver Detalles</Button>
        </Paper>
      );
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 2 }}>
        Buscar
      </Typography>
      
      <Box component="form" onSubmit={(e) => handleSearch(e, 1)} sx={{ mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar contenido, temas, caminos de conocimiento o personas..."
            fullWidth
          />
          <Button type="submit" variant="contained">
            Buscar
          </Button>
        </Stack>
        
        <RadioGroup
          row
          name="searchType"
          value={searchType}
          onChange={(e) => setSearchType(e.target.value)}
          sx={{ mt: 1 }}
        >
          <FormControlLabel value="all" control={<Radio size="small" />} label="Todo" />
          <FormControlLabel value="content" control={<Radio size="small" />} label="Contenido" />
          <FormControlLabel value="topics" control={<Radio size="small" />} label="Temas" />
          <FormControlLabel value="knowledge_paths" control={<Radio size="small" />} label="Caminos de Conocimiento" />
        </RadioGroup>
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
            <MuiLink component={Link} to="/profiles/login" underline="hover">Inicia sesión</MuiLink> para ver colecciones públicas.
          </Typography>
        )}
        {isAuthenticated && publicLoading && (
          <Typography variant="body2" sx={{ mt: 1 }}>Cargando colecciones…</Typography>
        )}
        {isAuthenticated && publicError && !publicLoading && (
          <Alert severity="error" sx={{ mt: 1 }}>{publicError}</Alert>
        )}
        {isAuthenticated && !publicLoading && !publicError && publicCollections.length === 0 && (
          <Typography variant="body2" sx={{ mt: 1 }}>Aún no hay colecciones públicas con contenido visible.</Typography>
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
                <CardActionArea onClick={() => navigate(`/content/collections/${c.id}`)}>
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
              
              {/* Pagination controls */}
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
                      bgcolor: pagination.currentPage < pagination.totalPages ? 'primary.main' : 'grey.300',
                      color: pagination.currentPage < pagination.totalPages ? 'white' : 'text.disabled',
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
            searchQuery && (
              <Alert severity="info">
                No se encontraron resultados para "{searchQuery}"
              </Alert>
            )
          )}
        </Box>
      )}
    </Container>
  );
};

export default MainSearch;
