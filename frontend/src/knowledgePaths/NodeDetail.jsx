import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';
import contentApi from '../api/contentApi';
import ContentDisplay from '../content/ContentDisplay';
import { getUserFromLocalStorage } from '../context/localStorageUtils';
import { Box, Typography, Alert, Chip, CircularProgress } from '@mui/material';
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
          setError('Failed to load node');
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
    } catch (error) {
      console.error('Error marking node as completed:', error);
      setError('Failed to mark node as completed');
      return;
    }

    // Check if the response indicates completion
    if (response.status === 'completed') {
      setNode(prev => ({ ...prev, is_completed: true }));
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
  if (error) return <Box className="container mx-auto p-4 text-red-600">{error}</Box>;
  if (!node) return <Box className="container mx-auto p-4">Node not found</Box>;

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
    <div className="container mx-auto p-4">
      <div className="max-w-2xl mx-auto">
        {/* Breadcrumb Navigation */}
        <div className="mb-6">
          <Link 
            to={`/knowledge_path/${pathId}`}
            className="text-blue-500 hover:text-blue-700"
          >
            {knowledgePath?.title}
          </Link>
          <span className="mx-2">›</span>
          <span className="text-gray-600">{node.title}</span>
        </div>

        {/* Node Content */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-4">{node.title}</h1>
          
          {/* Content Display */}
          <div className="mb-6">
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
                    This node doesn't have any attached content.
                  </Typography>
                  {node.media_type && (
                    <Chip 
                      icon={getMediaTypeIcon(node.media_type)} 
                      label={`Media type: ${node.media_type}`} 
                      color="primary" 
                      variant="outlined" 
                    />
                  )}
                </div>
              </Alert>
            )}
          </div>          

          {/* Description */}
          {node.description && (
            <div className="mt-4">
              <Typography variant="h6" sx={{ mb: 1 }}>Node Description</Typography>
              <Typography>{node.description}</Typography>
            </div>
          )}

          {/* Quiz Information */}
          {node.quizzes && node.quizzes.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <h2 className="text-lg font-semibold text-blue-700">
                Quiz: {node.quizzes[0].title || "Node includes a quiz"}                
              </h2>
              <p>Mark the node as completed to take the quiz</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex gap-4">
            {prevNode && (
              <button
                onClick={() => navigate(`/knowledge_path/${pathId}/nodes/${prevNode.id}`)}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                ← Previous
              </button>
            )}
            {user && user.username === knowledgePath?.author && (
              <Link
                to={`/knowledge_path/${pathId}/nodes/${nodeId}/edit`}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Edit Node
              </Link>
            )}
            <Link
              to={`/knowledge_path/${pathId}`}
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg transition-colors"
            >
              Back to Path
            </Link>
            {node.is_completed ? (
              <button
                onClick={() => {
                  // Check for quiz first
                  if (node.quizzes && node.quizzes.length > 0) {
                    navigate(`/quizzes/${node.quizzes[0].id}`);
                  } else if (nextNode) {
                    navigate(`/knowledge_path/${pathId}/nodes/${nextNode.id}`);
                  }
                }}
                className={`${nextNode ? 'bg-green-500 hover:bg-green-700' : 'bg-gray-500'} text-white font-bold py-2 px-4 rounded`}
                disabled={!nextNode && !node.quizzes?.length}
              >
                Already Completed {nextNode ? ': Next →' : ''}
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                Mark as Completed
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeDetail; 