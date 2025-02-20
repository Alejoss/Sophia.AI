import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';

const KnowledgePathList = () => {
  const [knowledgePaths, setKnowledgePaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchKnowledgePaths = async () => {
      try {
        const data = await knowledgePathsApi.getKnowledgePaths();
        setKnowledgePaths(data);
      } catch (err) {
        setError('Failed to load knowledge paths');
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledgePaths();
  }, []);

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (error) return <div className="text-red-500 text-center py-8">{error}</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Knowledge Paths</h1>
        <Link 
          to="/knowledge_path/create"
          className="bg-blue-500 hover:bg-blue-700 text-white !no-underline font-bold py-2 px-4 rounded transition-colors"
        >
          Create New Path
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {knowledgePaths.map((path) => (
          <Link 
            key={path.id}
            to={`/knowledge_path/${path.id}`}
            className="block p-6 bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-2">{path.title}</h2>
            <p className="text-gray-600 mb-4">{path.description}</p>
            <div className="flex justify-between text-sm text-gray-500">
              <span>By {path.author}</span>
              <span>{new Date(path.created_at).toLocaleDateString()}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default KnowledgePathList; 