import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Tabs,
  Tab,
  Button,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EditIcon from '@mui/icons-material/Edit';
import SchoolIcon from '@mui/icons-material/School';
import knowledgePathsApi from '../api/knowledgePathsApi';
import VoteComponent from '../votes/VoteComponent';

const KnowledgePathsUser = () => {
  const [activeTab, setActiveTab] = useState(0); // 0 = Created, 1 = Engaged
  
  // Created knowledge paths state
  const [createdPaths, setCreatedPaths] = useState([]);
  const [createdLoading, setCreatedLoading] = useState(true);
  const [createdError, setCreatedError] = useState(null);
  const [createdCurrentPage, setCreatedCurrentPage] = useState(1);
  const [createdTotalPages, setCreatedTotalPages] = useState(1);
  const [createdHasNext, setCreatedHasNext] = useState(false);
  const [createdHasPrevious, setCreatedHasPrevious] = useState(false);
  
  // Engaged knowledge paths state
  const [engagedPaths, setEngagedPaths] = useState([]);
  const [engagedLoading, setEngagedLoading] = useState(true);
  const [engagedError, setEngagedError] = useState(null);
  const [engagedCurrentPage, setEngagedCurrentPage] = useState(1);
  const [engagedTotalPages, setEngagedTotalPages] = useState(1);
  const [engagedHasNext, setEngagedHasNext] = useState(false);
  const [engagedHasPrevious, setEngagedHasPrevious] = useState(false);

  useEffect(() => {
    const fetchCreatedKnowledgePaths = async () => {
      try {
        const data = await knowledgePathsApi.getUserKnowledgePaths(createdCurrentPage);
        console.log('Created Knowledge Paths API Response:', data);
        setCreatedPaths(data.results);
        setCreatedTotalPages(Math.ceil(data.count / 9));
        setCreatedHasNext(!!data.next);
        setCreatedHasPrevious(!!data.previous);
      } catch (err) {
        console.error('Error fetching created knowledge paths:', err);
        setCreatedError('Error al cargar tus caminos de conocimiento creados');
      } finally {
        setCreatedLoading(false);
      }
    };

    const fetchEngagedKnowledgePaths = async () => {
      try {
        const data = await knowledgePathsApi.getUserEngagedKnowledgePaths(engagedCurrentPage);
        console.log('Engaged Knowledge Paths API Response:', data);
        setEngagedPaths(data.results);
        setEngagedTotalPages(Math.ceil(data.count / 9));
        setEngagedHasNext(!!data.next);
        setEngagedHasPrevious(!!data.previous);
      } catch (err) {
        console.error('Error fetching engaged knowledge paths:', err);
        setEngagedError('Error al cargar tus caminos de conocimiento en los que participas');
      } finally {
        setEngagedLoading(false);
      }
    };

    fetchCreatedKnowledgePaths();
    fetchEngagedKnowledgePaths();
  }, [createdCurrentPage, engagedCurrentPage]);

  const handleCreatedPageChange = (newPage) => {
    setCreatedCurrentPage(newPage);
    window.scrollTo(0, 0);
  };

  const handleEngagedPageChange = (newPage) => {
    setEngagedCurrentPage(newPage);
    window.scrollTo(0, 0);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const isLoading = createdLoading || engagedLoading;
  const currentError = activeTab === 0 ? createdError : engagedError;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, md: 3 } }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: { xs: 'wrap', md: 'nowrap' },
        }}
      >
        <Typography variant="h4" component="h1" sx={{ mb: { xs: 2, md: 0 } }}>
          Caminos de Conocimiento
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems="center" sx={{ width: { xs: '100%', md: 'auto' } }}>
          <Button
            component={Link}
            to="/knowledge_path"
            variant="outlined"
            color="primary"
            sx={{ textTransform: 'none', width: { xs: '100%', md: 'auto' } }}
          >
            Ver Todos los Caminos
          </Button>
          <Button
            component={Link}
            to="/knowledge_path/create"
            variant="contained"
            color="primary"
            sx={{ textTransform: 'none', width: { xs: '100%', md: 'auto' } }}
          >
            Crear Nuevo Camino
          </Button>
        </Stack>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="knowledge paths tabs">
          <Tab label={`Creados (${createdPaths.length})`} icon={<EditIcon />} iconPosition="start" />
          <Tab label={`En los que participo (${engagedPaths.length})`} icon={<SchoolIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Error State */}
      {currentError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {currentError}
        </Alert>
      )}

      {/* Created Knowledge Paths Tab - same card layout as KnowledgePathList */}
      {activeTab === 0 && !currentError && (
        <Box>
          <Grid container spacing={3}>
            {createdPaths.map((path) => (
              <Grid item xs={12} sm={6} lg={4} key={path.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': { boxShadow: 4 },
                  }}
                >
                  <Box sx={{ position: 'relative' }}>
                    {path.image ? (
                      <CardMedia
                        component="img"
                        height="140"
                        image={path.image}
                        alt={path.title}
                        sx={{
                          objectFit: 'cover',
                          objectPosition: path.image_focal_x != null && path.image_focal_y != null
                            ? `${(path.image_focal_x * 100).toFixed(1)}% ${(path.image_focal_y * 100).toFixed(1)}%`
                            : '50% 50%',
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          height: 140,
                          bgcolor: 'grey.300',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '3rem',
                          color: 'text.secondary',
                          fontWeight: 700,
                        }}
                      >
                        {path.title.charAt(0).toUpperCase()}
                      </Box>
                    )}
                    <Box sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.9)', borderRadius: 1 }}>
                      <Button
                        component={Link}
                        to={`/knowledge_path/${path.id}/edit`}
                        variant="outlined"
                        size="small"
                        startIcon={<EditIcon />}
                        sx={{ textTransform: 'none', minWidth: 'auto' }}
                      >
                        Editar
                      </Button>
                    </Box>
                  </Box>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        component={Link}
                        to={`/knowledge_path/${path.id}`}
                        variant="h5"
                        sx={{
                          display: 'block',
                          mb: 1,
                          textDecoration: 'none',
                          color: 'text.primary',
                          '&:hover': { color: 'primary.main' },
                          wordBreak: 'break-word',
                        }}
                      >
                        {path.title}
                      </Typography>
                      <Box sx={{ mb: 1.5 }}>
                        <Chip
                          icon={path.is_visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                          label={path.is_visible ? 'Público' : 'Privado'}
                          color={path.is_visible ? 'success' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {path.description}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <VoteComponent
                          type="knowledge_path"
                          ids={{ pathId: path.id }}
                          initialVoteCount={Number(path.vote_count) || 0}
                          initialUserVote={Number(path.user_vote) || 0}
                        />
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mt: 2,
                        pt: 2,
                        borderTop: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Por {path.author}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(path.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          {createdPaths.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary', mb: 2 }}>
                Aún no has creado caminos de conocimiento
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Comienza creando tu primer camino de conocimiento para organizar y compartir tu viaje de aprendizaje.
              </Typography>
              <Button component={Link} to="/knowledge_path/create" variant="contained" color="primary" sx={{ textTransform: 'none' }}>
                Crear Tu Primer Camino
              </Button>
            </Box>
          )}
          {createdTotalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 4 }}>
              <Button
                onClick={() => handleCreatedPageChange(createdCurrentPage - 1)}
                disabled={!createdHasPrevious}
                variant="contained"
                color={createdHasPrevious ? 'primary' : 'inherit'}
                sx={{
                  bgcolor: createdHasPrevious ? 'primary.main' : 'grey.300',
                  color: createdHasPrevious ? 'white' : 'text.disabled',
                  textTransform: 'none',
                  '&:disabled': { bgcolor: 'grey.300', color: 'text.disabled' },
                }}
              >
                Anterior
              </Button>
              <Typography variant="body2" color="text.secondary">
                Página {createdCurrentPage} de {createdTotalPages}
              </Typography>
              <Button
                onClick={() => handleCreatedPageChange(createdCurrentPage + 1)}
                disabled={!createdHasNext}
                variant="contained"
                color={createdHasNext ? 'primary' : 'inherit'}
                sx={{
                  bgcolor: createdHasNext ? 'primary.main' : 'grey.300',
                  color: createdHasNext ? 'white' : 'text.disabled',
                  textTransform: 'none',
                  '&:disabled': { bgcolor: 'grey.300', color: 'text.disabled' },
                }}
              >
                Siguiente
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* Engaged Knowledge Paths Tab - same card layout as KnowledgePathList */}
      {activeTab === 1 && !currentError && (
        <Box>
          <Grid container spacing={3}>
            {engagedPaths.map((path) => (
              <Grid item xs={12} sm={6} lg={4} key={path.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': { boxShadow: 4 },
                  }}
                >
                  {path.image ? (
                    <CardMedia
                      component="img"
                      height="140"
                      image={path.image}
                      alt={path.title}
                      sx={{
                        objectFit: 'cover',
                        objectPosition: path.image_focal_x != null && path.image_focal_y != null
                          ? `${(path.image_focal_x * 100).toFixed(1)}% ${(path.image_focal_y * 100).toFixed(1)}%`
                          : '50% 50%',
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        height: 140,
                        bgcolor: 'grey.300',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '3rem',
                        color: 'text.secondary',
                        fontWeight: 700,
                      }}
                    >
                      {path.title.charAt(0).toUpperCase()}
                    </Box>
                  )}
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        component={Link}
                        to={`/knowledge_path/${path.id}`}
                        variant="h5"
                        sx={{
                          display: 'block',
                          mb: 1.5,
                          textDecoration: 'none',
                          color: 'text.primary',
                          '&:hover': { color: 'primary.main' },
                          wordBreak: 'break-word',
                        }}
                      >
                        {path.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {path.description}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <VoteComponent
                          type="knowledge_path"
                          ids={{ pathId: path.id }}
                          initialVoteCount={Number(path.vote_count) || 0}
                          initialUserVote={Number(path.user_vote) || 0}
                        />
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mt: 2,
                        pt: 2,
                        borderTop: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Typography
                        component={Link}
                        to={path.author_id ? `/profiles/user_profile/${path.author_id}` : '#'}
                        variant="caption"
                        color="text.secondary"
                        sx={{ textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
                      >
                        Por {path.author}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(path.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          {engagedPaths.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary', mb: 2 }}>
                Aún no participas en caminos de conocimiento
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Comienza explorando caminos de conocimiento creados por otros usuarios para iniciar tu viaje de aprendizaje.
              </Typography>
              <Button component={Link} to="/knowledge_path" variant="contained" color="primary" sx={{ textTransform: 'none' }}>
                Explorar Caminos de Conocimiento
              </Button>
            </Box>
          )}
          {engagedTotalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 4 }}>
              <Button
                onClick={() => handleEngagedPageChange(engagedCurrentPage - 1)}
                disabled={!engagedHasPrevious}
                variant="contained"
                color={engagedHasPrevious ? 'primary' : 'inherit'}
                sx={{
                  bgcolor: engagedHasPrevious ? 'primary.main' : 'grey.300',
                  color: engagedHasPrevious ? 'white' : 'text.disabled',
                  textTransform: 'none',
                  '&:disabled': { bgcolor: 'grey.300', color: 'text.disabled' },
                }}
              >
                Anterior
              </Button>
              <Typography variant="body2" color="text.secondary">
                Página {engagedCurrentPage} de {engagedTotalPages}
              </Typography>
              <Button
                onClick={() => handleEngagedPageChange(engagedCurrentPage + 1)}
                disabled={!engagedHasNext}
                variant="contained"
                color={engagedHasNext ? 'primary' : 'inherit'}
                sx={{
                  bgcolor: engagedHasNext ? 'primary.main' : 'grey.300',
                  color: engagedHasNext ? 'white' : 'text.disabled',
                  textTransform: 'none',
                  '&:disabled': { bgcolor: 'grey.300', color: 'text.disabled' },
                }}
              >
                Siguiente
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Container>
  );
};

export default KnowledgePathsUser; 