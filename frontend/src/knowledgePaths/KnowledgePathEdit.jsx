import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Avatar, IconButton, FormControlLabel, Switch, Typography } from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import knowledgePathsApi from '../api/knowledgePathsApi';
import quizzesApi from '../api/quizzesApi';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditIcon from '@mui/icons-material/Edit';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

const KnowledgePathEdit = () => {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    is_visible: false
  });
  const [knowledgePathImage, setKnowledgePathImage] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRemovingNode, setIsRemovingNode] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isReordering, setIsReordering] = useState(false);
  const [quizzes, setQuizzes] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [knowledgePath, setKnowledgePath] = useState(null);

  useEffect(() => {
    const fetchKnowledgePath = async () => {
      try {
        const data = await knowledgePathsApi.getKnowledgePath(pathId);
        setKnowledgePath(data);
        setFormData({
          title: data.title,
          description: data.description,
          is_visible: data.is_visible || false
        });
        setKnowledgePathImage(data.image);
        setNodes(data.nodes || []);
        
        console.log('KnowledgePathEdit - Loaded knowledge path data:', data);
        console.log('KnowledgePathEdit - Image URL:', data.image);
        console.log('KnowledgePathEdit - Can be visible:', data.can_be_visible);
        
        // Fetch quizzes and map them to nodes using the correct attribute
        const quizzesData = await quizzesApi.getQuizzesByPathId(pathId);
        console.log('Fetched quizzes data:', quizzesData); // Log the quizzes data

        // Map quizzes to nodes using the 'node' attribute
        const quizzesMap = quizzesData.reduce((acc, quiz) => {
          if (!acc[quiz.node]) {
            acc[quiz.node] = [];
          }
          acc[quiz.node].push(quiz);
          return acc;
        }, {});
        console.log('Mapped quizzes:', quizzesMap); // Log the mapped quizzes
        setQuizzes(quizzesMap);
      } catch (err) {
        console.error('Failed to load knowledge path or quizzes', err);
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledgePath();
  }, [pathId]);

  // Refresh data when component becomes visible (e.g., returning from add node)
  useEffect(() => {
    const handleFocus = () => {
      refreshKnowledgePathData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [pathId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setKnowledgePathImage(URL.createObjectURL(file));
      // Store the file for upload
      setFormData(prevState => ({
        ...prevState,
        image: file
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage('');

    console.log('KnowledgePathEdit - Submitting form data:', formData);
    console.log('KnowledgePathEdit - Form data has image:', formData.image instanceof File);

    try {
      // Remove is_visible from formData since it's handled separately
      const { is_visible, ...submitData } = formData;
      const updatedData = await knowledgePathsApi.updateKnowledgePath(pathId, submitData);
      setSuccessMessage('Knowledge path updated successfully');
      
      // Update the image display with the new image URL from the response
      if (updatedData.image) {
        setKnowledgePathImage(updatedData.image);
      }
      
      // Clear the image file from formData after successful upload
      setFormData(prevState => {
        const { image, ...rest } = prevState;
        return rest;
      });
      
    } catch (err) {
      console.error('KnowledgePathEdit - Error updating knowledge path:', err);
      setError(err.message || 'Failed to update knowledge path');
    }
  };

  const handleAddNode = () => {
    navigate(`/knowledge_path/${pathId}/add-node`);
  };

  const refreshKnowledgePathData = async () => {
    try {
      const updatedData = await knowledgePathsApi.getKnowledgePath(pathId);
      setKnowledgePath(updatedData);
      setFormData(prevState => ({
        ...prevState,
        is_visible: updatedData.is_visible || false
      }));
      setNodes(updatedData.nodes || []);
    } catch (err) {
      console.error('Error refreshing knowledge path data:', err);
    }
  };

  const handleRemoveNode = async (nodeId) => {
    setIsRemovingNode(true);
    setError(null);

    try {
      await knowledgePathsApi.removeNode(pathId, nodeId);
      setNodes(nodes.filter(node => node.id !== nodeId));
      
      // Refresh knowledge path data to get updated visibility status
      const updatedData = await knowledgePathsApi.getKnowledgePath(pathId);
      setKnowledgePath(updatedData);
      setFormData(prevState => ({
        ...prevState,
        is_visible: updatedData.is_visible || false
      }));
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to remove node';
      setError(errorMessage);
    } finally {
      setIsRemovingNode(false);
    }
  };

  const handleAddActivityRequirement = () => {
    navigate(`/quizzes/${pathId}/create`);
  };

  const toggleForm = () => {
    setShowForm(!showForm);
  };

  const handleMoveNode = async (nodeId, direction) => {
    setIsReordering(true);
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
      </div>

      {/* Knowledge Path Header with Image and Title */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex items-start bg-white p-6 rounded-lg shadow">
          <Avatar 
            src={knowledgePathImage} 
            alt={formData.title}
            sx={{ 
              width: 100, 
              height: 100, 
              mr: 4,
              bgcolor: 'grey.300',
              fontSize: '2.5rem',
              flexShrink: 0
            }}
          >
            {formData.title ? formData.title.charAt(0).toUpperCase() : 'K'}
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{formData.title}</h1>
              <Link
                to={`/knowledge_path/${pathId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 transition-colors"
                title="View Knowledge Path"
              >
                <OpenInNewIcon />
              </Link>
            </div>
            <p className="text-gray-600 mb-4">{formData.description}</p>
            <div className="text-sm text-gray-500">
              Created by {knowledgePath?.author || 'Loading...'}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 flex gap-4 items-center">
        <button
          onClick={toggleForm}
          className={`font-bold py-2 px-4 rounded transition-colors ${
            showForm 
              ? 'bg-gray-500 hover:bg-gray-700 text-white' 
              : 'bg-green-500 hover:bg-green-700 text-white'
          }`}
        >
          {showForm ? 'Hide Form' : 'Edit Knowledge Path Details'}
        </button>
        
        {/* Visibility Toggle - Independent of form */}
        <div className="flex items-center gap-2 ml-auto">
          <FormControlLabel
            control={
              <Switch
                checked={formData.is_visible}
                disabled={!knowledgePath?.can_be_visible}
                onChange={async (e) => {
                  const newVisibility = e.target.checked;
                  try {
                    await knowledgePathsApi.updateKnowledgePath(pathId, { is_visible: newVisibility });
                    setFormData(prevState => ({
                      ...prevState,
                      is_visible: newVisibility
                    }));
                  } catch (err) {
                    console.error('Error updating visibility:', err);
                    // Revert the switch if the update failed
                    e.target.checked = !newVisibility;
                  }
                }}
                name="is_visible"
              />
            }
            label="Public"
            sx={{ mb: 0, color: 'text.primary' }}
          />
          <Typography variant="caption" color="text.secondary">
            {formData.is_visible ? 'Visible to others' : ''}
          </Typography>
          {!knowledgePath?.can_be_visible && (
            <Typography variant="caption" color="default" sx={{ ml: 1 }}>
              Knowledge paths need at least two nodes to be visible
            </Typography>
          )}
        </div>
      </div>

      {/* Form Section */}
      {showForm && (
        <div className="max-w-4xl mx-auto mt-6">
          <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
          {error && (
            <div className="text-red-600 mb-4">{error}</div>
          )}

          {/* Image Section */}
          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">
              Cover Image
            </label>
            <div className="flex items-center space-x-4">
              <Avatar 
                src={knowledgePathImage} 
                alt={formData.title}
                sx={{ 
                  width: 100, 
                  height: 100, 
                  bgcolor: 'grey.300',
                  fontSize: '2rem'
                }}
              >
                {formData.title ? formData.title.charAt(0).toUpperCase() : 'K'}
              </Avatar>
              <div>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="image-upload"
                  type="file"
                  onChange={handleImageUpload}
                />
                <label htmlFor="image-upload">
                  <IconButton
                    color="primary"
                    aria-label="upload picture"
                    component="span"
                    sx={{ 
                      border: '2px dashed #ccc',
                      borderRadius: '8px',
                      padding: '12px'
                    }}
                  >
                    <PhotoCameraIcon />
                  </IconButton>
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  Click to upload a cover image
                </p>
              </div>
            </div>
          </div>

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
        
        {successMessage && (
          <div className="mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {successMessage}
          </div>
        )}
        </div>
      )}

      {/* Node Management Section */}
      <div className="max-w-4xl mx-auto mt-6">
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
              Add Quiz
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
                    Quiz
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
                  console.log('Node ID:', node.id); // Log each node's ID
                  console.log('Node quizzes:', quizzes[node.id]); // Log quizzes for each node
                  return (
                    <tr key={node.id}>
                      <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300 text-gray-700">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300 text-gray-700">
                        {node.title || 'Untitled'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300 text-gray-700">
                        {node.media_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300 text-gray-700">
                        {quizzes[node.id] && quizzes[node.id].length > 0 ? (
                          quizzes[node.id].map((quiz, quizIndex) => (
                            <Link
                              key={quiz.id}
                              to={`/quizzes/${quiz.id}/edit`}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              {quiz.title || `Quiz ${quizIndex + 1}`}
                            </Link>
                          ))
                        ) : 'No'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300 text-gray-700">
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
                      <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300 text-gray-700">
                        <div className="flex gap-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleMoveNode(node.id, 'up')}
                              disabled={isReordering || index === 0}
                              className={`p-1 rounded hover:bg-gray-100 transition-colors text-gray-700
                                ${(isReordering || index === 0) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <ArrowUpwardIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleMoveNode(node.id, 'down')}
                              disabled={isReordering || index === nodes.length - 1}
                              className={`p-1 rounded hover:bg-gray-100 transition-colors text-gray-700
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
      </div>
    </div>
  );
};

export default KnowledgePathEdit; 