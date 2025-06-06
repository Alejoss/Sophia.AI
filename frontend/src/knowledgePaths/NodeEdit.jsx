import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';
import ContentSelector from '../content/ContentSelector';

const NodeEdit = () => {
  const { pathId, nodeId } = useParams();
  const navigate = useNavigate();
  const [knowledgePath, setKnowledgePath] = useState(null);
  const [selectedContent, setSelectedContent] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content_profile_id: null
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching data for node edit');
        // Fetch both the knowledge path and node data
        const [pathData, nodeData] = await Promise.all([
          knowledgePathsApi.getKnowledgePathBasic(pathId),
          knowledgePathsApi.getNode(pathId, nodeId)
        ]);

        console.log('Node data:', nodeData);
        setKnowledgePath(pathData);
        
        // Check if there's a content_profile_id
        const hasContentProfile = nodeData.content_profile_id !== null && nodeData.content_profile_id !== undefined;
        console.log('Has content profile?', hasContentProfile, 'content_profile_id:', nodeData.content_profile_id);
        
        // Set initial form data with the node information
        setFormData({
          title: nodeData.title,
          description: nodeData.description || '',
          content_profile_id: hasContentProfile ? nodeData.content_profile_id : null
        });
        
        // If we have a content profile ID, fetch the content details
        if (hasContentProfile) {
          try {
            console.log('Fetching content profile:', nodeData.content_profile_id);
            const contentProfileData = await knowledgePathsApi.getNodeContent(nodeData.content_profile_id);
            console.log('Content profile data:', contentProfileData);
            setSelectedContent(contentProfileData);
          } catch (contentErr) {
            console.error('Error fetching content profile:', contentErr);
            setSelectedContent(null);
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pathId, nodeId]);

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

    try {
      console.log('Submitting form data:', formData);
      await knowledgePathsApi.updateNode(pathId, nodeId, formData);
      navigate(`/knowledge_path/${pathId}/edit`);
    } catch (err) {
      console.error('Error updating node:', err);
      setError(err.message || 'Failed to update node');
    }
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
        </div>
      </div>
    </div>
  );
};

export default NodeEdit; 