import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';
import ContentDisplay from './ContentDisplay';
import { useAuth } from '../context/AuthContext';

const NodeDetail = () => {
  const { pathId, nodeId } = useParams();
  const [node, setNode] = useState(null);
  const [knowledgePath, setKnowledgePath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { authState } = useAuth();
  const { user } = authState;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [nodeData, pathData] = await Promise.all([
          knowledgePathsApi.getNode(pathId, nodeId),
          knowledgePathsApi.getKnowledgePathBasic(pathId)
        ]);
        setNode(nodeData);
        setKnowledgePath(pathData);
      } catch (err) {
        setError('Failed to load node');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pathId, nodeId]);

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
            <ContentDisplay 
              content={{
                id: node.content_id,
                original_title: node.title,
                media_type: node.media_type,
                file_details: node.file_details
              }} 
            />
          </div>

          {/* Description */}
          {node.description && (
            <div className="mt-4">
              <h2 className="text-lg font-semibold mb-2">Description</h2>
              <p className="text-gray-700">{node.description}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex gap-4">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeDetail; 