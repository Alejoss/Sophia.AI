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
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import knowledgePathsApi from '../api/knowledgePathsApi';
import VoteComponent from '../votes/VoteComponent';

const KnowledgePathsByUser = ({ userId, authorName }) => {
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
        const results = Array.isArray(data.results) ? data.results : [];
        setPaths(results);
        setTotalPages(Math.ceil((data.count || 0) / 9));
        setHasNext(!!data.next);
        setHasPrevious(!!data.previous);
      } catch (err) {
        console.error('Error fetching knowledge paths by user:', err);
        setError('Error al cargar los caminos de conocimiento');
        setPaths([]);
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
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, md: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          Caminos de Conocimiento por {authorName}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {(paths || []).map((path) => (
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

      {paths.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary', mb: 2 }}>
            Aún no se han creado caminos de conocimiento
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {authorName} aún no ha creado caminos de conocimiento.
          </Typography>
        </Box>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 4 }}>
          <Button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!hasPrevious}
            variant="contained"
            color={hasPrevious ? 'primary' : 'inherit'}
            sx={{
              bgcolor: hasPrevious ? 'primary.main' : 'grey.300',
              color: hasPrevious ? 'white' : 'text.disabled',
              textTransform: 'none',
              '&:disabled': { bgcolor: 'grey.300', color: 'text.disabled' },
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
              '&:disabled': { bgcolor: 'grey.300', color: 'text.disabled' },
            }}
          >
            Siguiente
          </Button>
        </Box>
      )}
    </Container>
  );
};

export default KnowledgePathsByUser; 