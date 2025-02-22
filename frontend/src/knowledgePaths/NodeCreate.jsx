import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';
import ContentSearchModal from './ContentSearchModal';
import ContentDisplay from './ContentDisplay';

const NodeCreate = () => {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const [knowledgePath, setKnowledgePath] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content_id: null
  });
  const [selectedContent, setSelectedContent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKnowledgePath = async () => {
      try {
        const data = await knowledgePathsApi.getKnowledgePathBasic(pathId);
        setKnowledgePath(data);
      } catch (err) {
        setError('Failed to load knowledge path');
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledgePath();
  }, [pathId]);

  const handleSelectContent = (content) => {
    setSelectedContent(content);
    setFormData(prev => ({
      ...prev,
      content_id: content.id,
      title: content.original_title || 'Untitled',
      description: content.description || ''
    }));
    setIsModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      await knowledgePathsApi.addNode(pathId, formData);
      navigate(`/knowledge_path/${pathId}/edit`);
    } catch (err) {
      setError(err.message || 'Failed to add node');
    }
  };

  if (loading) {
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  if (error) {
    return <div className="container mx-auto p-4 text-red-600">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Add Content Node</h1>
        <h2 className="text-gray-600 mb-6">
          to Knowledge Path: {knowledgePath?.title}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Select Content
            </button>
            <ContentDisplay content={selectedContent} />
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Node Title
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={!formData.content_id}
              className={`px-4 py-2 rounded-lg ${
                formData.content_id
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Add Node
            </button>
            <button
              type="button"
              onClick={() => navigate(`/knowledge_path/${pathId}/edit`)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>

        <ContentSearchModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSelectContent={handleSelectContent}
        />
      </div>
    </div>
  );
};

export default NodeCreate; 