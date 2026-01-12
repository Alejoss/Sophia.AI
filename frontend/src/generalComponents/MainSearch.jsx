import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import generalApi from '../api/generalApi';
import ContentDisplay from '../content/ContentDisplay';
import '/src/styles/search.css';

// Import icons for different result types
import TopicIcon from '@mui/icons-material/Label';
import KnowledgePathIcon from '@mui/icons-material/AccountTree';

const MainSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchType, setSearchType] = useState('all'); // 'all', 'content', 'topics', 'knowledge_paths', 'people'
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalResults: 0
  });
  const navigate = useNavigate();

  const handleSearch = async (e, page = 1) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const response = await generalApi.search(searchQuery, searchType, page);
      
      // Update search results
      setSearchResults(response.results);
      
      // Update pagination info
      setPagination({
        currentPage: response.current_page,
        totalPages: response.total_pages,
        totalResults: response.count
      });
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      handleSearch(new Event('submit'), newPage);
    }
  };

  const handleResultClick = (result) => {
    // Construct URL based on result type and ID
    let url;
    
    if (result.type === 'content') {
      // If it's a content profile, include the profile ID in the URL
      if (result.source === 'profile' && result.profile_id) {
        url = `/content/search/${result.content.id}?profile=${result.profile_id}`;
      } else {
        url = `/content/search/${result.content.id}`;
      }
    } else if (result.type === 'topic') {
      url = `/content/topics/${result.id}`;
    } else if (result.type === 'knowledge_path') {
      url = `/knowledge_path/${result.id}`;
    }
    
    if (url) {
      // Pass the search query to the next component
      navigate(url, { state: { searchQuery } });
    }
  };

  // Get icon for result type
  const getResultTypeIcon = (type) => {
    if (type === 'topic') {
      return <TopicIcon className="result-type-icon" />;
    } else if (type === 'knowledge_path') {
      return <KnowledgePathIcon className="result-type-icon" />;
    } else {
      return null; // ContentDisplay will handle content icons
    }
  };

  // Render search result item
  const renderResultItem = (result) => {
    if (result.type === 'content') {
      // Use ContentDisplay for content results
      return (
        <li key={result.id} className="result-item">
          <ContentDisplay
            content={result}
            variant="simple"
            onClick={() => handleResultClick(result)}
            showActions={false}
          />
        </li>
      );
    } else {
      // Render topics and knowledge paths with the original format
      return (
        <li 
          key={result.id} 
          className="result-item"
          onClick={() => handleResultClick(result)}
        >
          <div className="result-item-header">
            <div className="result-type-badge">
              {getResultTypeIcon(result.type)}
              <span className="result-type-text">
                {result.type}
              </span>
            </div>
          </div>
          
          <h3 className="result-title">{result.title}</h3>
          
          {result.description && (
            <p className="result-description">{result.description}</p>
          )}
          
          <div className="result-footer">
            <button className="view-details-button">Ver Detalles</button>
          </div>
        </li>
      );
    }
  };

  return (
    <div className="search-container">
      <h1>Buscar</h1>
      
      <form onSubmit={(e) => handleSearch(e, 1)} className="search-form">
        <div className="search-input-container">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar contenido, temas, caminos de conocimiento o personas..."
            className="search-input"
          />
          <button type="submit" className="search-button">
            Buscar
          </button>
        </div>
        
        <div className="search-filters">
          <label>
            <input
              type="radio"
              name="searchType"
              value="all"
              checked={searchType === 'all'}
              onChange={(e) => setSearchType(e.target.value)}
            />
            Todo
          </label>
          <label>
            <input
              type="radio"
              name="searchType"
              value="content"
              checked={searchType === 'content'}
              onChange={(e) => setSearchType(e.target.value)}
            />
            Contenido
          </label>
          <label>
            <input
              type="radio"
              name="searchType"
              value="topics"
              checked={searchType === 'topics'}
              onChange={(e) => setSearchType(e.target.value)}
            />
            Temas
          </label>
          <label>
            <input
              type="radio"
              name="searchType"
              value="knowledge_paths"
              checked={searchType === 'knowledge_paths'}
              onChange={(e) => setSearchType(e.target.value)}
            />
            Caminos de Conocimiento
          </label>
        </div>
      </form>

      {isLoading ? (
        <div className="loading">Cargando resultados...</div>
      ) : (
        <div className="search-results">
          {searchResults.length > 0 ? (
            <>
              <div className="results-summary">
                Mostrando {searchResults.length} de {pagination.totalResults} resultados
              </div>
              <ul className="results-list">
                {searchResults.map(renderResultItem)}
              </ul>
              
              {/* Pagination controls */}
              {pagination.totalPages > 1 && (
                <div className="pagination-controls">
                  <button 
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={pagination.currentPage === 1}
                    className="pagination-button"
                  >
                    Anterior
                  </button>
                  
                  <span className="pagination-info">
                    Página {pagination.currentPage} de {pagination.totalPages}
                  </span>
                  
                  <button 
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={pagination.currentPage === pagination.totalPages}
                    className="pagination-button"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          ) : (
            searchQuery && <p className="no-results">No se encontraron resultados para "{searchQuery}"</p>
          )}
        </div>
      )}
    </div>
  );
};

export default MainSearch; 