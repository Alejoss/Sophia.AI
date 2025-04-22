import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';
import ContentSearchModal from '../content/ContentSearchModal';
import ContentDisplay from '../content/ContentDisplay';

const NodeEdit = () => {
  const { pathId, nodeId } = useParams();
  const navigate = useNavigate();
  const [knowledgePath, setKnowledgePath] = useState(null);
  const [selectedContent, setSelectedContent] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch both the knowledge path and node data
        const [pathData, nodeData] = await Promise.all([
          knowledgePathsApi.getKnowledgePathBasic(pathId),
          knowledgePathsApi.getNode(pathId, nodeId)
        ]);

        setKnowledgePath(pathData);
        setFormData({
          title: nodeData.title,
          description: nodeData.description || ''
        });
        // Set selected content info for display
        setSelectedContent({
          id: nodeData.content_id,
          original_title: nodeData.title,
          media_type: nodeData.media_type,
          file_details: nodeData.file_details
        });
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pathId, nodeId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      await knowledgePathsApi.updateNode(pathId, nodeId, formData);
      navigate(`/knowledge_path/${pathId}/edit`);
    } catch (err) {
      setError(err.message || 'Failed to update node');
    }
  };

  const handleSelectContent = async (content) => {
    setSelectedContent({
      id: content.id,
      original_title: content.original_title || content.title,
      media_type: content.media_type,
      file_details: content.file_details
    });
    setFormData(prev => ({
      ...prev,
      content_id: content.id,
      title: content.original_title || content.title || 'Untitled',
    }));
    setIsModalOpen(false);
  };

  if (loading) return <div className="container mx-auto p-4">Loading...</div>;
  if (error) return <div className="container mx-auto p-4 text-red-600">{error}</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Edit Content Node</h1>
        <h2 className="text-gray-600 mb-6">
          in Knowledge Path: {knowledgePath?.title}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Change Content
            </button>
            <ContentDisplay content={selectedContent} />
          </div>

          {/* Title Input */}
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

          {/* Description Input */}
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

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => navigate(`/knowledge_path/${pathId}/edit`)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg"
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

export default NodeEdit; 