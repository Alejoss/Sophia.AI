import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Chip, Box } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SchoolIcon from '@mui/icons-material/School';
import knowledgePathsApi from '../api/knowledgePathsApi';
import VoteComponent from '../votes/VoteComponent';
import { AuthContext } from '../context/AuthContext';

const KnowledgePathsByUser = ({ userId, authorName }) => {
  const { authState } = useContext(AuthContext);
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  useEffect(() => {
    const fetchKnowledgePaths = async () => {
      try {
        const data = await knowledgePathsApi.getUserKnowledgePathsById(userId, currentPage);
        console.log('Knowledge Paths by User API Response:', data);
        setPaths(data.results);
        setTotalPages(Math.ceil(data.count / 9));
        setHasNext(!!data.next);
        setHasPrevious(!!data.previous);
      } catch (err) {
        console.error('Error fetching knowledge paths by user:', err);
        setError('Error al cargar las rutas de conocimiento');
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledgePaths();
  }, [userId, currentPage]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <div className="text-center py-8">Cargando...</div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center py-8">{error}</div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center md:flex-nowrap flex-wrap md:gap-0 gap-4 mb-6">
        <h1 className="md:!text-2xl !text-xl font-bold !text-gray-900">
          Rutas de Conocimiento por {authorName}
        </h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
        {paths.map((path) => (
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
                    label={path.is_visible ? 'Público' : 'Privado'}
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

            {/* Date */}
            <div className="flex justify-between items-center text-sm text-gray-500">
              <span>{new Date(path.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* No Knowledge Paths Message */}
      {paths.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-xl font-semibold text-gray-600 mb-4">Aún no se han creado rutas de conocimiento</h3>
          <p className="text-gray-500 mb-6">
            {authorName} aún no ha creado rutas de conocimiento.
          </p>
        </div>
      )}

      {/* Pagination Controls */}
      {paths.length > 0 && (
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
            Anterior
          </button>
          
          <span className="text-gray-600">
            Página {currentPage} de {totalPages}
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
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

export default KnowledgePathsByUser; 