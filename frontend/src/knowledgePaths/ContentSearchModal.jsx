import React, { useState, useEffect } from 'react';
import contentApi from '../api/contentApi';

const ContentSearchModal = ({ isOpen, onClose, onSelectContent, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [userContent, setUserContent] = useState([]);
  const [filteredContent, setFilteredContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserContent = async () => {
      try {
        const content = await contentApi.getUserContent();
        setUserContent(content);
        setFilteredContent(content);
      } catch (err) {
        setError('Failed to load content');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchUserContent();
    }
  }, [isOpen]);

  useEffect(() => {
    const filtered = userContent.filter(content =>
      content.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredContent(filtered);
  }, [searchTerm, userContent]);

  if (!isOpen) return null;

  const getMediaTypeStyles = (mediaType) => {
    switch(mediaType) {
      case 'VIDEO':
        return 'bg-red-100 text-red-800';
      case 'AUDIO':
        return 'bg-yellow-100 text-yellow-800';
      case 'TEXT':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Modal Container */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg m-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-800">
            Select Content in your Library
          </h3>
          {!isLoading && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="text-2xl">×</span>
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="p-6 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          />
        </div>

        {/* Content List */}
        <div className="p-6 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-4">
              {error}
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              No content found
            </div>
          ) : (
            <div className="space-y-3">
              {filteredContent.map((content) => (
                <div
                  key={content.id}
                  onClick={!isLoading ? () => onSelectContent(content) : undefined}
                  className={`group p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all 
                    ${!isLoading ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                        {content.title}
                      </h4>
                      <span className={`inline-block px-3 py-1 mt-2 text-xs font-medium rounded-full ${getMediaTypeStyles(content.media_type)}`}>
                        {content.media_type}
                      </span>
                    </div>
                    <span className="text-gray-400 group-hover:text-blue-500 transition-colors">
                      →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          {isLoading ? (
            <div className="flex items-center text-gray-600">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent mr-2"></div>
              Adding content...
            </div>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContentSearchModal; 