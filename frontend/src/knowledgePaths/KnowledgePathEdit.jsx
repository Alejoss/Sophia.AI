import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';
import ContentSearchModal from './ContentSearchModal';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditIcon from '@mui/icons-material/Edit';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

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
  const [isReordering, setIsReordering] = useState(false);

  useEffect(() => {
    const fetchKnowledgePath = async () => {
      try {
        const data = await knowledgePathsApi.getKnowledgePath(pathId);
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
    navigate(`/knowledge_path/${pathId}/add-node`);
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

  const handleMoveNode = async (nodeId, direction) => {
    setIsReordering(true);
    console.log('Moving node:', nodeId, 'direction:', direction);
    try {
      const currentIndex = nodes.findIndex(node => node.id === nodeId);
      if (currentIndex === -1) return;

      const newNodes = [...nodes];
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      // Swap nodes
      [newNodes[currentIndex], newNodes[targetIndex]] = [newNodes[targetIndex], newNodes[currentIndex]];

      // Prepare order data
      const nodeOrders = newNodes.map((node, index) => ({
        id: node.id,
        order: index + 1
      }));
      console.log('Sending node orders:', nodeOrders);

      // Update backend
      const updatedNodes = await knowledgePathsApi.reorderNodes(pathId, nodeOrders);
      setNodes(updatedNodes);
    } catch (err) {
      console.error('Reorder error:', err.response?.data || err.message);
      setError('Failed to reorder nodes');
    } finally {
      setIsReordering(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header with Back Link */}
      <div className="max-w-4xl mx-auto mb-6">
        <Link
          to={`/knowledge_path/${pathId}`}
          className="text-blue-500 hover:text-blue-700 mb-4 inline-block"
        >
          ← Back to Path
        </Link>
        <h1 className="text-2xl font-bold">Edit Knowledge Path</h1>
      </div>

      {/* Form Section */}
      <div className="max-w-4xl mx-auto mt-6">
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
          {error && (
            <div className="text-red-600 mb-4">{error}</div>
          )}

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
                          to={`/knowledge_path/${pathId}/nodes/${node.id}`}
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
                        <div className="flex gap-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleMoveNode(node.id, 'up')}
                              disabled={isReordering || index === 0}
                              className={`p-1 rounded hover:bg-gray-100 transition-colors
                                ${(isReordering || index === 0) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <ArrowUpwardIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleMoveNode(node.id, 'down')}
                              disabled={isReordering || index === nodes.length - 1}
                              className={`p-1 rounded hover:bg-gray-100 transition-colors
                                ${(isReordering || index === nodes.length - 1) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <ArrowDownwardIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <Link
                            to={`/knowledge_path/${pathId}/nodes/${node.id}/edit`}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            Edit
                          </Link>
                          <button 
                            onClick={() => handleRemoveNode(node.id)}
                            disabled={isRemovingNode}
                            className={`text-red-600 hover:text-red-900 transition-colors
                              ${isRemovingNode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            Remove
                          </button>
                        </div>
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
    </div>
  );
};

export default KnowledgePathEdit; 