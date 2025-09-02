import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';
import ContentSelector from '../content/ContentSelector';

const NodeCreate = () => {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const [knowledgePath, setKnowledgePath] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content_profile_id: null
  });
  const [selectedContent, setSelectedContent] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  const handleContentSelected = (content_profile) => {
    console.log('Selected content profile:', content_profile);
    console.log('Content profile title:', content_profile.title);
    console.log('Content profile original title:', content_profile.content?.original_title);
    console.log('Current form data:', formData);
    
    setSelectedContent(content_profile);
    setFormData(prev => {
      const newFormData = {
        ...prev,
        content_profile_id: content_profile.id,
        title: prev.title || content_profile.title || content_profile.content?.original_title || 'Untitled'
      };
      console.log('New form data being set:', newFormData);
      return newFormData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await knowledgePathsApi.addNode(pathId, formData);
      navigate(`/knowledge_path/${pathId}/edit`);
    } catch (err) {
      setError(err.message || 'Failed to add node');
    } finally {
      setSubmitting(false);
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
        <h1 className="md:!text-2xl !text-xl font-bold mb-2 !text-gray-900">Add Content Node</h1>
        <h2 className="text-gray-600 mb-6">
          to Knowledge Path: {knowledgePath?.title}
        </h2>

        <div className="space-y-6">
          <ContentSelector
            selectedContent={selectedContent}
            onContentSelected={handleContentSelected}
            onContentRemoved={() => {
              setSelectedContent(null);
              setFormData(prev => ({
                ...prev,
                content_profile_id: null
              }));
            }}
            previewVariant="detailed"
          />

          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div className="flex gap-4 md:flex-nowrap flex-wrap">
              <button
                type="submit"
                disabled={!formData.content_profile_id || submitting}
                className={`px-4 py-2 rounded-lg ${
                  formData.content_profile_id && !submitting
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {submitting ? 'Adding...' : 'Add Node'}
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
        </div>
      </div>
    </div>
  );
};

export default NodeCreate; 