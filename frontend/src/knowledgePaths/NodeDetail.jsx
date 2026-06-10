import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';
import contentApi from '../api/contentApi';
import ContentDisplay from '../content/ContentDisplay';
import { getUserFromLocalStorage } from '../context/localStorageUtils';
import { Box, Typography, Alert, Chip, CircularProgress, Button, Stack, Paper, Container, Link as MuiLink } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import AudioFileIcon from '@mui/icons-material/AudioFile';

// Added to track render cycles
let renderCount = 0;

const NodeDetail = () => {
  const { pathId, nodeId } = useParams();
  const navigate = useNavigate();
  const [node, setNode] = useState(null);
  const [nodeContent, setNodeContent] = useState(null);
  const [knowledgePath, setKnowledgePath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextNode, setNextNode] = useState(null);
  const [prevNode, setPrevNode] = useState(null);
  const user = getUserFromLocalStorage();
  
  // Track render count to detect potential infinite loops
  renderCount++;
  console.log(`🔄 NodeDetail RENDER #${renderCount} - pathId: ${pathId}, nodeId: ${nodeId}`);

  useEffect(() => {
    console.log('📥 useEffect triggered - fetching data');
    
    // Reset renderCount on path/node change
    renderCount = 1;
    
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        console.log('🔍 Starting API calls');
        const startTime = performance.now();
        
        // Fetch node and path data first
        const [nodeData, pathData] = await Promise.all([
          knowledgePathsApi.getNode(pathId, nodeId),
          knowledgePathsApi.getKnowledgePath(pathId)
        ]);
        
        if (!isMounted) return;
        
        setNode(nodeData);
        setKnowledgePath(pathData);
        
        // Find next and previous nodes by order
        const nextAvailableNode = pathData.nodes.find(n => 
          n.order === nodeData.order + 1
        );
        const previousNode = pathData.nodes.find(n => 
          n.order === nodeData.order - 1
        );
        
        setNextNode(nextAvailableNode);
        setPrevNode(previousNode);
        
        // If content_profile_id exists, fetch content details using the same endpoint as ContentDetailsTopic
        if (nodeData.content_profile_id) {
          // Get the content ID from the content profile
          const contentProfile = await knowledgePathsApi.getNodeContent(nodeData.content_profile_id);
          if (contentProfile && contentProfile.content && contentProfile.content.id) {
            const contentId = contentProfile.content.id;
            console.log('Fetching content details with context=knowledge_path:', contentId);
            
            // Use the same endpoint as ContentDetailsTopic but with knowledge_path context
            const contentData = await contentApi.getContentPreview(contentId, 'knowledge_path', pathId);
            if (isMounted) {
              console.log('Content data loaded:', contentData);
              setNodeContent(contentData);
            }
          }
        }
        
        const endTime = performance.now();
        console.log(`✅ API calls completed in ${Math.round(endTime - startTime)}ms`);
      } catch (err) {
        console.error('❌ Error fetching data:', err);
        if (isMounted) {
          setError('Error al cargar el nodo');
        }
      } finally {
        if (isMounted) {
          console.log('✅ Setting loading to false');
          setLoading(false);
        }
      }
    };

    fetchData();
    
    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up NodeDetail component');
      isMounted = false;
    };
  }, [pathId, nodeId]);

  const handleComplete = async () => {
    console.log('🎯 handleComplete called');
    let response;
    try {
      response = await knowledgePathsApi.markNodeCompleted(pathId, nodeId);
      console.log('Response from marking node completed:', response);
      
      // Backend returns {"message": "Node completed successfully"}
      // If we get a successful response, mark the node as completed
      setNode(prev => ({ ...prev, is_completed: true }));
    } catch (error) {
      console.error('Error marking node as completed:', error);
      setError('Error al marcar el nodo como completado');
      return;
    }
        
    // Check if there's a quiz for this node
    if (node.quizzes && node.quizzes.length > 0) {
      navigate(`/quizzes/${node.quizzes[0].id}`);
      return;
    }
    if (nextNode) {
      navigate(`/knowledge_path/${pathId}/nodes/${nextNode.id}`);
    } else {
      navigate(`/knowledge_path/${pathId}`);
    }
  };

  console.log('🧩 Before render - loading:', loading, 'error:', error, 'node exists:', !!node);

  if (loading) return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress /></Box>;
  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }
  if (!node) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Alert severity="warning">Nodo no encontrado</Alert>
      </Container>
    );
  }

  console.log('🧩 Ready to render with node:', {
    id: node.id, 
    title: node.title,
    has_content: !!nodeContent
  });

  // Helper function to get media type icon
  const getMediaTypeIcon = (mediaType) => {
    const type = (mediaType || '').toUpperCase();
    switch (type) {
      case 'IMAGE': return <ImageIcon />;
      case 'VIDEO': return <VideoFileIcon />;
      case 'TEXT': return <TextSnippetIcon />;
      case 'AUDIO': return <AudioFileIcon />;
      default: return null;
    }
  };

  return (
    <Container sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, md: 3 } }}>
      <Box sx={{ maxWidth: 672, mx: 'auto' }}>
        {/* Breadcrumb Navigation */}
        <Typography variant="body2" sx={{ mb: 2 }}>
          <MuiLink
            component={Link}
            to={`/knowledge_path/${pathId}`}
            underline="hover"
            color="primary"
            sx={{ fontWeight: 500 }}
          >
            {knowledgePath?.title}
          </MuiLink>
          <Typography component="span" sx={{ mx: 1 }}>›</Typography>
          <Typography component="span" color="text.secondary">{node.title}</Typography>
        </Typography>

        {/* Node Content */}
        <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
            {node.title}
          </Typography>
          
          {/* Content Display */}
          <Box sx={{ mb: 3 }}>
            {nodeContent ? (
              <>
                {console.log('🖼️ Rendering ContentDisplay with:', nodeContent.content)}
                <ContentDisplay 
                  content={nodeContent.content}
                  variant="preview"
                  showAuthor={true}
                />
              </>
            ) : (
              <Alert severity="info" sx={{ mb: 2 }}>
                <div>
                  <Typography variant="body1" gutterBottom>
                    Este nodo no tiene contenido adjunto.
                  </Typography>
                  {node.media_type && (
                    <Chip 
                      icon={getMediaTypeIcon(node.media_type)} 
                      label={`Tipo de medio: ${node.media_type}`} 
                      color="primary" 
                      variant="outlined" 
                    />
                  )}
                </div>
              </Alert>
            )}
          </Box>

          {/* Description */}
          {node.description && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>Descripción del Nodo</Typography>
              <Typography
                variant="body1"
                sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word', lineHeight: 1.8 }}
              >
                {String(node.description).replace(/<br\s*\/?>/gi, '\n')}
              </Typography>
            </Box>
          )}

          {/* Quiz Information */}
          {node.quizzes && node.quizzes.length > 0 && (
            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Cuestionario: {node.quizzes[0].title || 'El nodo incluye un cuestionario'}
              </Typography>
              <Typography variant="body2">Marca el nodo como completado para realizar el cuestionario.</Typography>
            </Alert>
          )}

          {/* Action Buttons */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            flexWrap="wrap"
            gap={2}
            sx={{ mt: 4 }}
          >
            {prevNode && (
              <Button
                variant="outlined"
                onClick={() => navigate(`/knowledge_path/${pathId}/nodes/${prevNode.id}`)}
                sx={{ textTransform: 'none', minWidth: { xs: '100%', sm: 'auto' } }}
              >
                ← Anterior
              </Button>
            )}
            {user && user.username === knowledgePath?.author && (
              <Button
                component={Link}
                to={`/knowledge_path/${pathId}/nodes/${nodeId}/edit`}
                variant="outlined"
                sx={{ textTransform: 'none', minWidth: { xs: '100%', sm: 'auto' } }}
              >
                Editar Nodo
              </Button>
            )}
            <Button
              component={Link}
              to={`/knowledge_path/${pathId}`}
              variant="outlined"
              color="inherit"
              sx={{ textTransform: 'none', minWidth: { xs: '100%', sm: 'auto' } }}
            >
              Volver al Camino
            </Button>
            {node.is_completed ? (
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  if (node.quizzes && node.quizzes.length > 0) {
                    navigate(`/quizzes/${node.quizzes[0].id}`);
                  } else if (nextNode) {
                    navigate(`/knowledge_path/${pathId}/nodes/${nextNode.id}`);
                  }
                }}
                disabled={!nextNode && !node.quizzes?.length}
                sx={{ textTransform: 'none', minWidth: { xs: '100%', sm: 'auto' } }}
              >
                Ya Completado {nextNode ? '— Siguiente →' : ''}
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                onClick={handleComplete}
                sx={{ textTransform: 'none', minWidth: { xs: '100%', sm: 'auto' } }}
              >
                Marcar como Completado
              </Button>
            )}
          </Stack>
        </Paper>
      </Box>
    </Container>
  );
};

export default NodeDetail; 