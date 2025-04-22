import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';
import ContentDisplay from '../content/ContentDisplay';
import { getUserFromLocalStorage } from '../context/localStorageUtils';
import { Box, Typography } from '@mui/material';

const NodeDetail = () => {
  const { pathId, nodeId } = useParams();
  const navigate = useNavigate();
  const [node, setNode] = useState(null);
  const [knowledgePath, setKnowledgePath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextNode, setNextNode] = useState(null);
  const [prevNode, setPrevNode] = useState(null);
  const user = getUserFromLocalStorage();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [nodeData, pathData] = await Promise.all([
          knowledgePathsApi.getNode(pathId, nodeId),
          knowledgePathsApi.getKnowledgePath(pathId)
        ]);
        
       
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
      } catch (err) {
        setError('Failed to load node');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pathId, nodeId]);

  useEffect(() => {
    console.log('NodeDetail received node:', node);
    if (node?.content_profile) {
      console.log('Content profile:', node.content_profile);
    }
  }, [node]);

  const handleComplete = async () => {
    // Add debug log before API call
    let response;
    try {
      response = await knowledgePathsApi.markNodeCompleted(pathId, nodeId);
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

  if (loading) return <div className="container mx-auto p-4">Loading...</div>;
  if (error) return <div className="container mx-auto p-4 text-red-600">{error}</div>;
  if (!node) return <div className="container mx-auto p-4">Node not found</div>;

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
            {node.content_profile && (
              <ContentDisplay 
                content_profile={node.content_profile}
                variant="detailed"
                showAuthor={true}
                showType={true}
              />
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