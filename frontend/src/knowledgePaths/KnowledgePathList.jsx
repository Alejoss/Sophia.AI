import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';
import VoteComponent from '../votes/VoteComponent';

const KnowledgePathList = () => {
  const [knowledgePaths, setKnowledgePaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  useEffect(() => {
    const fetchKnowledgePaths = async () => {
      try {
        const data = await knowledgePathsApi.getKnowledgePaths(currentPage);
        console.log('API Response:', data);
        console.log('Knowledge Paths:', data.results);
        setKnowledgePaths(data.results);
        setTotalPages(Math.ceil(data.count / 9));
        setHasNext(!!data.next);
        setHasPrevious(!!data.previous);
      } catch (err) {
        console.error('Error fetching knowledge paths:', err);
        setError('Failed to load knowledge paths');
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledgePaths();
  }, [currentPage]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo(0, 0);
  };

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
        {knowledgePaths.map((path) => {
          console.log('Rendering path:', path);
          console.log('Path vote count:', path.vote_count);
          console.log('Path user vote:', path.user_vote);
          return (
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
          );
        })}
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-center items-center space-x-4 mt-8">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={!hasPrevious}
          className={`px-4 py-2 rounded-lg ${
            hasPrevious
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Previous
        </button>
        
        <span className="text-gray-600">
          Page {currentPage} of {totalPages}
        </span>
        
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={!hasNext}
          className={`px-4 py-2 rounded-lg ${
            hasNext
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default KnowledgePathList; 