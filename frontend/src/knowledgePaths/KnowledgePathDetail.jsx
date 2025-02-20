import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';

const KnowledgePathDetail = () => {
  const { pathId } = useParams();
  const [knowledgePath, setKnowledgePath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchKnowledgePath = async () => {
      try {
        const data = await knowledgePathsApi.getKnowledgePath(pathId);
        setKnowledgePath(data);
      } catch (err) {
        setError('Failed to load knowledge path');
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledgePath();
  }, [pathId]);

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (error) return <div className="text-red-500 text-center py-8">{error}</div>;
  if (!knowledgePath) return <div className="text-center py-8">Knowledge path not found</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{knowledgePath.title}</h1>
            <p className="text-gray-600">Created by {knowledgePath.author}</p>
          </div>
          <Link
            to={`/knowledge_path/${pathId}/edit`}
            className="bg-blue-500 hover:bg-blue-700 text-white !no-underline font-bold py-2 px-4 rounded transition-colors"
          >
            Edit Path
          </Link>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Description</h2>
          <p className="text-gray-700">{knowledgePath.description}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Content Nodes</h2>
          {knowledgePath.nodes?.length > 0 ? (
            <div className="space-y-4">
              {knowledgePath.nodes.map((node, index) => (
                <div 
                  key={node.id}
                  className="flex items-center p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <span className="font-bold text-gray-500 mr-4">{index + 1}</span>
                  <div>
                    <h3 className="font-medium">{node.title}</h3>
                    <span className="text-sm text-gray-500">{node.media_type}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No content nodes added yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgePathDetail; 