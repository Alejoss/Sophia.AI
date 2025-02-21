import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';
import ContentSearchModal from './ContentSearchModal';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const KnowledgePathEdit = () => {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });
  const [nodes, setNodes] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [isRemovingNode, setIsRemovingNode] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const fetchKnowledgePath = async () => {
      try {
        const data = await knowledgePathsApi.getKnowledgePath(pathId);
        console.log('Knowledge path data:', data);
        console.log('Nodes:', data.nodes);
        setFormData({
          title: data.title,
          description: data.description
        });
        setNodes(data.nodes || []);
      } catch (err) {
        setError('Failed to load knowledge path');
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledgePath();
  }, [pathId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage('');

    try {
      await knowledgePathsApi.updateKnowledgePath(pathId, formData);
      setSuccessMessage('Knowledge path updated successfully');
    } catch (err) {
      setError(err.message || 'Failed to update knowledge path');
    }
  };

  const handleAddNode = () => {
    setIsModalOpen(true);
  };

  const handleSelectContent = async (content) => {
    setIsAddingNode(true);
    setError(null);

    try {
      const newNode = await knowledgePathsApi.addNode(pathId, {
        content_id: content.id
      });
      setNodes([...nodes, newNode]);
      setIsModalOpen(false);
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to add node';
      setError(errorMessage);
    } finally {
      setIsAddingNode(false);
    }
  };

  const handleRemoveNode = async (nodeId) => {
    setIsRemovingNode(true);
    setError(null);

    try {
      await knowledgePathsApi.removeNode(pathId, nodeId);
      setNodes(nodes.filter(node => node.id !== nodeId));
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to remove node';
      setError(errorMessage);
    } finally {
      setIsRemovingNode(false);
    }
  };

  const handleAddActivityRequirement = () => {
    navigate(`/knowledge_path/${pathId}/add-quiz`);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Edit Knowledge Path</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-lg mb-8">
        <div className="mb-4">
          <label htmlFor="title" className="block text-gray-700 font-bold mb-2">
            Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="description" className="block text-gray-700 font-bold mb-2">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            rows="4"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Update Knowledge Path
        </button>
      </form>

      <div className="mb-4">
        <button
          onClick={handleAddNode}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mr-2"
        >
          Add Content Node
        </button>
        {nodes.length >= 2 && (
          <button
            onClick={handleAddActivityRequirement}
            className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
          >
            Add Activity Requirement
          </button>
        )}
      </div>

      {nodes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr>
                <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Media Type
                </th>
                <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  View
                </th>
                <th className="px-6 py-3 border-b-2 border-gray-300 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node, index) => {
                console.log('Node data:', node);
                return (
                  <tr key={node.id}>
                    <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300">
                      {node.title || 'Untitled'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300">
                      {node.media_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300">
                      <Link
                        to={`/content/${node.content_id}/library`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View
                        <OpenInNewIcon className="w-4 h-4" />
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300">
                      <button 
                        onClick={() => handleRemoveNode(node.id)}
                        disabled={isRemovingNode}
                        className={`text-red-600 hover:text-red-900 transition-colors
                          ${isRemovingNode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ContentSearchModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setError(null);
        }}
        onSelectContent={handleSelectContent}
        isLoading={isAddingNode}
      />
    </div>
  );
};

export default KnowledgePathEdit; 