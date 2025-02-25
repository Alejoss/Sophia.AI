import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';
import { getUserFromLocalStorage } from '../context/localStorageUtils';
import { Lock, LockOpen, CheckCircle } from '@mui/icons-material';

const KnowledgePathDetail = () => {
  const { pathId } = useParams();
  const [knowledgePath, setKnowledgePath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreator, setIsCreator] = useState(false);
  const user = getUserFromLocalStorage();

  useEffect(() => {
    const fetchKnowledgePath = async () => {
      try {
        const data = await knowledgePathsApi.getKnowledgePath(pathId);
        console.log('Knowledge path data:', data);
        console.log('Current user:', user);
        console.log('Path author:', data.author);
        setKnowledgePath(data);
        setIsCreator(user?.username === data.author);
        console.log('Is creator:', user?.username === data.author);
      } catch (err) {
        setError('Failed to load knowledge path');
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledgePath();
  }, [pathId, user?.username]);

  console.log('Current user:', user);
  console.log('Knowledge path author:', knowledgePath?.author);

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
          {isCreator && (
            <Link
              to={`/knowledge_path/${pathId}/edit`}
              className="bg-blue-500 hover:bg-blue-700 text-white !no-underline font-bold py-2 px-4 rounded transition-colors"
            >
              Edit Path
            </Link>
          )}
        </div>

        {!isCreator && knowledgePath.progress && (
          <div className="mb-6">
            <div className="bg-gray-200 rounded-full h-4 mb-2">
              <div 
                className="bg-blue-500 rounded-full h-4 transition-all duration-500"
                style={{ width: `${knowledgePath.progress.percentage}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              Completed {knowledgePath.progress.completed_nodes} of {knowledgePath.progress.total_nodes} nodes
            </p>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Description</h2>
          <p className="text-gray-700">{knowledgePath.description}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Content Nodes</h2>
          {knowledgePath.nodes?.length > 0 ? (
            <div className="space-y-4">
              {console.log('Rendering nodes:', knowledgePath.nodes)}
              {knowledgePath.nodes.map((node, index) => {
                console.log(`Node ${node.id}:`, {
                  title: node.title,
                  is_available: node.is_available,
                  is_completed: node.is_completed,
                  isCreator
                });
                return (
                  <div 
                    key={node.id}
                    className={`flex items-center p-4 rounded-lg border 
                      ${node.is_available ? 'bg-gray-50 border-gray-200' : 'bg-gray-100 border-gray-300'}`}
                  >
                    <span className="font-bold text-gray-500 mr-4">{index + 1}</span>
                    <div className="flex-grow">
                      {node.is_available ? (
                        <Link 
                          to={`/knowledge_path/${pathId}/nodes/${node.id}`}
                          className="font-medium hover:text-blue-500"
                        >
                          {node.title}
                        </Link>
                      ) : (
                        <span className="text-gray-500">{node.title}</span>
                      )}
                      <span className="text-sm text-gray-500 ml-2">{node.media_type}</span>
                    </div>
                    <div className="flex items-center">
                      {node.is_completed && <CheckCircle className="text-green-500 mr-2" />}
                      {!node.is_available && !isCreator && <Lock className="text-gray-500" />}
                      {node.is_available && !node.is_completed && <LockOpen className="text-blue-500" />}
                    </div>
                  </div>
                );
              })}
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