import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Chip, Tabs, Tab, Box } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EditIcon from '@mui/icons-material/Edit';
import SchoolIcon from '@mui/icons-material/School';
import knowledgePathsApi from '../api/knowledgePathsApi';
import VoteComponent from '../votes/VoteComponent';
import { AuthContext } from '../context/AuthContext';

const KnowledgePathsUser = () => {
  const { authState } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState(0); // 0 = Created, 1 = Engaged
  
  // Created knowledge paths state
  const [createdPaths, setCreatedPaths] = useState([]);
  const [createdLoading, setCreatedLoading] = useState(true);
  const [createdError, setCreatedError] = useState(null);
  const [createdCurrentPage, setCreatedCurrentPage] = useState(1);
  const [createdTotalPages, setCreatedTotalPages] = useState(1);
  const [createdHasNext, setCreatedHasNext] = useState(false);
  const [createdHasPrevious, setCreatedHasPrevious] = useState(false);
  
  // Engaged knowledge paths state
  const [engagedPaths, setEngagedPaths] = useState([]);
  const [engagedLoading, setEngagedLoading] = useState(true);
  const [engagedError, setEngagedError] = useState(null);
  const [engagedCurrentPage, setEngagedCurrentPage] = useState(1);
  const [engagedTotalPages, setEngagedTotalPages] = useState(1);
  const [engagedHasNext, setEngagedHasNext] = useState(false);
  const [engagedHasPrevious, setEngagedHasPrevious] = useState(false);

  useEffect(() => {
    const fetchCreatedKnowledgePaths = async () => {
      try {
        const data = await knowledgePathsApi.getUserKnowledgePaths(createdCurrentPage);
        console.log('Created Knowledge Paths API Response:', data);
        setCreatedPaths(data.results);
        setCreatedTotalPages(Math.ceil(data.count / 9));
        setCreatedHasNext(!!data.next);
        setCreatedHasPrevious(!!data.previous);
      } catch (err) {
        console.error('Error fetching created knowledge paths:', err);
        setCreatedError('Failed to load your created knowledge paths');
      } finally {
        setCreatedLoading(false);
      }
    };

    const fetchEngagedKnowledgePaths = async () => {
      try {
        const data = await knowledgePathsApi.getUserEngagedKnowledgePaths(engagedCurrentPage);
        console.log('Engaged Knowledge Paths API Response:', data);
        setEngagedPaths(data.results);
        setEngagedTotalPages(Math.ceil(data.count / 9));
        setEngagedHasNext(!!data.next);
        setEngagedHasPrevious(!!data.previous);
      } catch (err) {
        console.error('Error fetching engaged knowledge paths:', err);
        setEngagedError('Failed to load your engaged knowledge paths');
      } finally {
        setEngagedLoading(false);
      }
    };

    fetchCreatedKnowledgePaths();
    fetchEngagedKnowledgePaths();
  }, [createdCurrentPage, engagedCurrentPage]);

  const handleCreatedPageChange = (newPage) => {
    setCreatedCurrentPage(newPage);
    window.scrollTo(0, 0);
  };

  const handleEngagedPageChange = (newPage) => {
    setEngagedCurrentPage(newPage);
    window.scrollTo(0, 0);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const isLoading = createdLoading || engagedLoading;
  const currentError = activeTab === 0 ? createdError : engagedError;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Knowledge Paths</h1>
        <Link 
          to="/knowledge_path/create"
          className="bg-blue-500 hover:bg-blue-700 text-white !no-underline font-bold py-2 px-4 rounded transition-colors"
        >
          Create New Path
        </Link>
      </div>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="knowledge paths tabs">
          <Tab 
            label={`Created (${createdPaths.length})`} 
            icon={<EditIcon />} 
            iconPosition="start"
          />
          <Tab 
            label={`Engaged (${engagedPaths.length})`} 
            icon={<SchoolIcon />} 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">Loading...</div>
      )}

      {/* Error State */}
      {currentError && (
        <div className="text-red-500 text-center py-8">{currentError}</div>
      )}

      {/* Created Knowledge Paths Tab */}
      {activeTab === 0 && !isLoading && !currentError && (
        <div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {createdPaths.map((path) => (
              <div 
                key={path.id}
                className="block p-6 bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow min-h-[200px]"
              >
                {/* Image and Title Section */}
                <div className="flex items-start mb-4">
                  <Avatar 
                    src={path.image} 
                    alt={path.title}
                    sx={{ 
                      width: 80, 
                      height: 80, 
                      mr: 3,
                      bgcolor: 'grey.300',
                      flexShrink: 0
                    }}
                  >
                    {path.title.charAt(0).toUpperCase()}
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    {/* Title Section */}
                    <Link 
                      to={`/knowledge_path/${path.id}`}
                      className="text-xl font-semibold hover:text-blue-500 transition-colors break-words block mb-3"
                    >
                      {path.title}
                    </Link>

                    {/* Visibility Status */}
                    <div className="mb-3">
                      <Chip
                        icon={path.is_visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                        label={path.is_visible ? 'Public' : 'Private'}
                        color={path.is_visible ? 'success' : 'default'}
                        size="small"
                        variant="outlined"
                      />
                    </div>

                    {/* Description */}
                    <p className="text-gray-600 mb-3 line-clamp-3">{path.description}</p>

                    {/* Vote Component */}
                    <div className="flex justify-end">
                      <VoteComponent 
                        type="knowledge_path"
                        ids={{ pathId: path.id }}
                        initialVoteCount={Number(path.vote_count) || 0}
                        initialUserVote={Number(path.user_vote) || 0}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions and Date */}
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>{new Date(path.created_at).toLocaleDateString()}</span>
                  <div className="flex gap-2">
                    <Link
                      to={`/knowledge_path/${path.id}/edit`}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <EditIcon className="w-4 h-4" />
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* No Created Knowledge Paths Message */}
          {createdPaths.length === 0 && (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold text-gray-600 mb-4">No knowledge paths created yet</h3>
              <p className="text-gray-500 mb-6">Start creating your first knowledge path to organize and share your learning journey.</p>
              <Link 
                to="/knowledge_path/create"
                className="bg-blue-500 hover:bg-blue-700 text-white !no-underline font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Create Your First Path
              </Link>
            </div>
          )}

          {/* Created Paths Pagination Controls */}
          {createdPaths.length > 0 && (
            <div className="flex justify-center items-center space-x-4 mt-8">
              <button
                onClick={() => handleCreatedPageChange(createdCurrentPage - 1)}
                disabled={!createdHasPrevious}
                className={`px-4 py-2 rounded-lg ${
                  createdHasPrevious
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Previous
              </button>
              
              <span className="text-gray-600">
                Page {createdCurrentPage} of {createdTotalPages}
              </span>
              
              <button
                onClick={() => handleCreatedPageChange(createdCurrentPage + 1)}
                disabled={!createdHasNext}
                className={`px-4 py-2 rounded-lg ${
                  createdHasNext
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Engaged Knowledge Paths Tab */}
      {activeTab === 1 && !isLoading && !currentError && (
        <div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {engagedPaths.map((path) => (
              <div 
                key={path.id}
                className="block p-6 bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow min-h-[200px]"
              >
                {/* Image and Title Section */}
                <div className="flex items-start mb-4">
                  <Avatar 
                    src={path.image} 
                    alt={path.title}
                    sx={{ 
                      width: 80, 
                      height: 80, 
                      mr: 3,
                      bgcolor: 'grey.300',
                      flexShrink: 0
                    }}
                  >
                    {path.title.charAt(0).toUpperCase()}
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    {/* Title Section */}
                    <Link 
                      to={`/knowledge_path/${path.id}`}
                      className="text-xl font-semibold hover:text-blue-500 transition-colors break-words block mb-3"
                    >
                      {path.title}
                    </Link>

                    {/* Author Info */}
                    <div className="mb-3">
                      <p className="text-sm text-gray-500">
                        By {path.author}
                      </p>
                    </div>

                    {/* Description */}
                    <p className="text-gray-600 mb-3 line-clamp-3">{path.description}</p>
                  </div>
                </div>

                {/* Date */}
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>{new Date(path.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* No Engaged Knowledge Paths Message */}
          {engagedPaths.length === 0 && (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold text-gray-600 mb-4">No engaged knowledge paths yet</h3>
              <p className="text-gray-500 mb-6">Start exploring knowledge paths created by other users to begin your learning journey.</p>
              <Link 
                to="/knowledge_path"
                className="bg-blue-500 hover:bg-blue-700 text-white !no-underline font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Browse Knowledge Paths
              </Link>
            </div>
          )}

          {/* Engaged Paths Pagination Controls */}
          {engagedPaths.length > 0 && (
            <div className="flex justify-center items-center space-x-4 mt-8">
              <button
                onClick={() => handleEngagedPageChange(engagedCurrentPage - 1)}
                disabled={!engagedHasPrevious}
                className={`px-4 py-2 rounded-lg ${
                  engagedHasPrevious
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Previous
              </button>
              
              <span className="text-gray-600">
                Page {engagedCurrentPage} of {engagedTotalPages}
              </span>
              
              <button
                onClick={() => handleEngagedPageChange(engagedCurrentPage + 1)}
                disabled={!engagedHasNext}
                className={`px-4 py-2 rounded-lg ${
                  engagedHasNext
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KnowledgePathsUser; 