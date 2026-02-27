import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Chip, Box, CardMedia, Button, Typography } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SchoolIcon from '@mui/icons-material/School';
import knowledgePathsApi from '../api/knowledgePathsApi';
import VoteComponent from '../votes/VoteComponent';
import { AuthContext } from '../context/AuthContext';

const KnowledgePathsByUser = ({ userId, authorName }) => {
  const { authState } = useContext(AuthContext);
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  useEffect(() => {
    const fetchKnowledgePaths = async () => {
      try {
        const data = await knowledgePathsApi.getUserKnowledgePathsById(userId, currentPage);
        console.log('Knowledge Paths by User API Response:', data);
        setPaths(data.results);
        setTotalPages(Math.ceil(data.count / 9));
        setHasNext(!!data.next);
        setHasPrevious(!!data.previous);
      } catch (err) {
        console.error('Error fetching knowledge paths by user:', err);
        setError('Error al cargar los caminos de conocimiento');
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledgePaths();
  }, [userId, currentPage]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <div className="text-center py-8">Cargando...</div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center py-8">{error}</div>
    );
  }

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
          Caminos de Conocimiento por {authorName}
        </Typography>
      </Box>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
        {paths.map((path) => (
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

                  {/* Footer: Vote and Date */}
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

                    {/* Date */}
                    <Typography variant="caption" color="text.secondary">
                      {new Date(path.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
            </div>
          </div>
        ))}
      </div>

      {/* No Knowledge Paths Message */}
      {paths.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography
            variant="h6"
            sx={{
              fontSize: "1.25rem",
              fontWeight: 600,
              color: 'text.secondary',
              mb: 2
            }}
          >
            Aún no se han creado caminos de conocimiento
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {authorName} aún no ha creado caminos de conocimiento.
          </Typography>
        </Box>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
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
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!hasPrevious}
            variant="contained"
            color={hasPrevious ? 'primary' : 'inherit'}
            sx={{
              bgcolor: hasPrevious ? 'primary.main' : 'grey.300',
              color: hasPrevious ? 'white' : 'text.disabled',
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
            Página {currentPage} de {totalPages}
          </Typography>
          
          <Button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!hasNext}
            variant="contained"
            color={hasNext ? 'primary' : 'inherit'}
            sx={{
              bgcolor: hasNext ? 'primary.main' : 'grey.300',
              color: hasNext ? 'white' : 'text.disabled',
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
  );
};

export default KnowledgePathsByUser; 