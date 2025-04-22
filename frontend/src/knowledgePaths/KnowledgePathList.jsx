import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';
import VoteComponent from '../votes/VoteComponent';

const KnowledgePathList = () => {
  const [knowledgePaths, setKnowledgePaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchKnowledgePaths = async () => {
      try {
        const data = await knowledgePathsApi.getKnowledgePaths();
        console.log('Knowledge paths data:', data);
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
          <div 
            key={path.id}
            className="block p-6 bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
          >
            {/* Title and Vote Section */}
            <div className="flex justify-between items-start mb-4">
              <Link 
                to={`/knowledge_path/${path.id}`}
                className="text-xl font-semibold hover:text-blue-500 transition-colors"
              >
                {path.title}
              </Link>
              <VoteComponent 
                type="knowledge_path"
                ids={{ pathId: path.id }}
                initialVoteCount={path.vote_count}
                initialUserVote={path.user_vote}
              />
            </div>

            {/* Description */}
            <p className="text-gray-600 mb-4">{path.description}</p>

            {/* Author and Date */}
            <div className="flex justify-between text-sm text-gray-500">
              <Link 
                to={`/profiles/user_profile/${path.author_id}`}
                className="hover:text-blue-500 transition-colors"
              >
                By {path.author}
              </Link>
              <span>{new Date(path.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KnowledgePathList; 