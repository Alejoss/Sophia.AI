import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Chip, Tabs, Tab, Box, Typography, CardMedia, Button, Stack } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EditIcon from '@mui/icons-material/Edit';
import SchoolIcon from '@mui/icons-material/School';
import knowledgePathsApi from '../api/knowledgePathsApi';
import VoteComponent from '../votes/VoteComponent';
import { AuthContext } from '../context/AuthContext';

const KnowledgePathsUser = () => {
  const { authState } = useContext(AuthContext);
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

  return (
    <div className="container mx-auto p-4">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: { xs: 'wrap', md: 'nowrap' }, gap: 2, mb: 4 }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            fontSize: {
              xs: "1.5rem", // ~24px on mobile
              sm: "1.75rem", // ~28px on small screens
              md: "2.125rem", // ~34px on desktop (default h4)
            },
            fontWeight: 600,
          }}
        >
          Caminos de Conocimiento
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
          <Button
            component={Link}
            to="/knowledge_path"
            variant="outlined"
            color="primary"
            sx={{ textTransform: 'none' }}
          >
            Ver Todos los Caminos
          </Button>
          <Button
            component={Link}
            to="/knowledge_path/create"
            variant="contained"
            color="primary"
            sx={{ textTransform: 'none' }}
          >
            Crear Nuevo Camino
          </Button>
        </Stack>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="knowledge paths tabs">
          <Tab 
            label={`Creados (${createdPaths.length})`} 
            icon={<EditIcon />} 
            iconPosition="start"
          />
          <Tab 
            label={`En los que participo (${engagedPaths.length})`} 
            icon={<SchoolIcon />} 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">Cargando...</div>
      )}

      {/* Error State */}
      {currentError && (
        <div className="text-red-500 text-center py-8">{currentError}</div>
      )}

      {/* Created Knowledge Paths Tab */}
      {activeTab === 0 && !isLoading && !currentError && (
        <div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {createdPaths.map((path) => (
              <div 
                key={path.id}
                className="block bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow overflow-hidden"
              >
                {/* Cover Image */}
                {path.image ? (
                  <CardMedia
                    component="img"
                    height="140"
                    image={path.image}
                    alt={path.title}
                    sx={{ objectFit: 'cover' }}
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
                
                {/* Content Section */}
                <div className="p-6">
                  <div className="flex-1 min-w-0">
                    {/* Title Section */}
                    <Box sx={{ mb: 2, textAlign: 'center' }}>
                      <Typography
                        component={Link}
                        to={`/knowledge_path/${path.id}`}
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          color: 'text.primary',
                          textDecoration: 'none',
                          display: 'block',
                          wordBreak: 'break-word',
                          '&:hover': {
                            color: 'primary.main',
                            textDecoration: 'none',
                          },
                        }}
                      >
                        <br />
                        {path.title}
                      </Typography>
                    </Box>

                    {/* Visibility Status */}
                    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'left' }}>
                      <Chip
                        icon={path.is_visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                        label={path.is_visible ? 'Público' : 'Privado'}
                        color={path.is_visible ? 'success' : 'default'}
                        size="small"
                        variant="outlined"
                      />
                    </Box>

                    {/* Description */}
                    <p className="text-gray-600 mb-3 line-clamp-7">{path.description}</p>
                  </div>

                  {/* Footer: Vote, Date, and Actions */}
                  <Box 
                    sx={{ 
                      mt: 3,
                      pt: 2,
                      borderTop: 1,
                      borderColor: 'divider',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 2
                    }}
                  >
                    {/* Vote Component */}
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <VoteComponent 
                        type="knowledge_path"
                        ids={{ pathId: path.id }}
                        initialVoteCount={Number(path.vote_count) || 0}
                        initialUserVote={Number(path.user_vote) || 0}
                      />
                    </Box>

                    {/* Date and Edit Button */}
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(path.created_at).toLocaleDateString()}
                      </Typography>
                      <Button
                        component={Link}
                        to={`/knowledge_path/${path.id}/edit`}
                        variant="outlined"
                        size="small"
                        startIcon={<EditIcon />}
                        sx={{ 
                          textTransform: 'none',
                          minWidth: 'auto'
                        }}
                      >
                        Editar
                      </Button>
                    </Stack>
                  </Box>
                </div>
              </div>
            ))}
          </div>

          {/* No Created Knowledge Paths Message */}
          {createdPaths.length === 0 && (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold text-gray-600 mb-4">Aún no has creado caminos de conocimiento</h3>
              <p className="text-gray-500 mb-6">Comienza creando tu primer camino de conocimiento para organizar y compartir tu viaje de aprendizaje.</p>
              <Link 
                to="/knowledge_path/create"
                className="bg-blue-500 hover:bg-blue-700 !text-white !no-underline font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Crear Tu Primer Camino
              </Link>
            </div>
          )}

          {/* Created Paths Pagination Controls */}
          {createdTotalPages > 1 && (
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
                onClick={() => handleCreatedPageChange(createdCurrentPage - 1)}
                disabled={!createdHasPrevious}
                variant="contained"
                color={createdHasPrevious ? 'primary' : 'inherit'}
                sx={{
                  bgcolor: createdHasPrevious ? 'primary.main' : 'grey.300',
                  color: createdHasPrevious ? 'white' : 'text.disabled',
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
        </div>
      )}

      {/* Engaged Knowledge Paths Tab */}
      {activeTab === 1 && !isLoading && !currentError && (
        <div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {engagedPaths.map((path) => (
              <div 
                key={path.id}
                className="block bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow overflow-hidden"
              >
                {/* Cover Image */}
                {path.image ? (
                  <CardMedia
                    component="img"
                    height="140"
                    image={path.image}
                    alt={path.title}
                    sx={{ objectFit: 'cover' }}
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
                
                {/* Content Section */}
                <div className="p-6">
                  <div className="flex-1 min-w-0">
                    {/* Title Section */}
                    <Box sx={{ mb: 2, textAlign: 'center' }}>
                      <Typography
                        component={Link}
                        to={`/knowledge_path/${path.id}`}
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          color: 'text.primary',
                          textDecoration: 'none',
                          display: 'block',
                          wordBreak: 'break-word',
                          '&:hover': {
                            color: 'primary.main',
                            textDecoration: 'none',
                          },
                        }}
                      >
                        {path.title}
                      </Typography>
                    </Box>

                    {/* Author Info */}
                    <Box sx={{ mb: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Por {path.author}
                      </Typography>
                    </Box>

                    {/* Description */}
                    <p className="text-gray-600 mb-3 line-clamp-7">{path.description}</p>
                  </div>

                  {/* Footer: Date */}
                  <Box 
                    sx={{ 
                      mt: 3,
                      pt: 2,
                      borderTop: 1,
                      borderColor: 'divider',
                      display: 'flex',
                      justifyContent: 'flex-start',
                      alignItems: 'center'
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {new Date(path.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                </div>
              </div>
            ))}
          </div>

          {/* No Engaged Knowledge Paths Message */}
          {engagedPaths.length === 0 && (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold !text-gray-600 mb-4">Aún no participas en caminos de conocimiento</h3>
              <p className="text-gray-500 mb-6">Comienza explorando caminos de conocimiento creados por otros usuarios para iniciar tu viaje de aprendizaje.</p>
              <Link 
                to="/knowledge_path"
                className="bg-blue-500 hover:bg-blue-700 !text-white !no-underline font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Explorar Caminos de Conocimiento
              </Link>
            </div>
          )}

          {/* Engaged Paths Pagination Controls */}
          {engagedTotalPages > 1 && (
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
                onClick={() => handleEngagedPageChange(engagedCurrentPage - 1)}
                disabled={!engagedHasPrevious}
                variant="contained"
                color={engagedHasPrevious ? 'primary' : 'inherit'}
                sx={{
                  bgcolor: engagedHasPrevious ? 'primary.main' : 'grey.300',
                  color: engagedHasPrevious ? 'white' : 'text.disabled',
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
        </div>
      )}
    </div>
  );
};

export default KnowledgePathsUser; 