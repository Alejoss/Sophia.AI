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
            console.log('Content profile data (full):', JSON.stringify(contentProfileData, null, 2));
            
            // Check if content exists in the response
            if (!contentProfileData.content) {
              console.error('Content field missing in contentProfileData', contentProfileData);
              throw new Error('Content data missing in the response');
            }
            
            // Check if we have required content fields
            const contentData = contentProfileData.content;
            console.log('Content data structure:', {
              id: contentData.id,
              media_type: contentData.media_type,
              hasFileDetails: !!contentData.file_details,
              fileDetailsData: contentData.file_details
            });
            
            // Set selected content info for display
            setSelectedContent({
              id: contentData.id,
              original_title: contentProfileData.title || nodeData.title,
              media_type: contentData.media_type,
              file_details: contentData.file_details,
              url: contentData.url // Add URL in case it's available directly on content
            });
          } catch (contentErr) {
            console.error('Error fetching content profile:', contentErr);
            console.error('Error details:', contentErr.response?.data || contentErr.message);
            // Don't fail the whole component if just the content profile fails
            setSelectedContent({
              id: null,
              original_title: nodeData.title,
              media_type: nodeData.media_type,
              file_details: null
            });
          }
        } else {
          // There's no content profile - use node info only
          setSelectedContent({
            id: null,
            original_title: nodeData.title,
            media_type: nodeData.media_type,
            file_details: null
          });
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        console.error('Error details:', err.response?.data || err.message);
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
      console.log('Submitting form data:', formData);
      await knowledgePathsApi.updateNode(pathId, nodeId, formData);
      navigate(`/knowledge_path/${pathId}/edit`);
    } catch (err) {
      console.error('Error updating node:', err);
      console.error('Error details:', err.response?.data || err.message);
      setError(err.message || 'Failed to update node');
    }
  };

  const handleSelectContent = async (content) => {
    console.log('Selected content:', content);
    
    // Make sure we have the content_profile_id
    const contentProfileId = content.profile_id || content.id;
    console.log('Using content_profile_id:', contentProfileId);
    
    setSelectedContent({
      id: content.id,
      original_title: content.original_title || content.title,
      media_type: content.media_type,
      file_details: content.file_details,
      url: content.url // Include URL if available
    });
    
    setFormData(prev => ({
      ...prev,
      content_profile_id: contentProfileId,
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
              {selectedContent?.id ? "Change Content" : "Select Content"}
            </button>
            
            {selectedContent ? (
              <>
                <ContentDisplay content={selectedContent} variant="simple" />
              </>
            ) : (
              <div className="mt-4 p-4 bg-gray-100 rounded-lg text-gray-600">
                No content selected. Please choose content for this node.
              </div>
            )}
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