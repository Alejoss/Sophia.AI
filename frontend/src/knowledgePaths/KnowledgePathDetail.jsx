import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';
import commentsApi from '../api/commentsApi';
import { getUserFromLocalStorage } from '../context/localStorageUtils';
import { Lock, LockOpen, CheckCircle } from '@mui/icons-material';
import CommentSection from '../comments/CommentSection';
import VoteComponent from '../votes/VoteComponent';

// TODO: Add a progress bar to the knowledge path detail page
const KnowledgePathDetail = () => {
  const { pathId } = useParams();
  const [knowledgePath, setKnowledgePath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreator, setIsCreator] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const user = getUserFromLocalStorage();

  // TODO no se ve el edit path si ya esta completado
  useEffect(() => {
    const fetchKnowledgePath = async () => {
      try {
        const data = await knowledgePathsApi.getKnowledgePath(pathId);
        setKnowledgePath(data);
        setIsCreator(user?.username === data.author);

        if (data.progress?.is_completed) {
          const commentsData = await commentsApi.getKnowledgePathComments(pathId);
          setComments(commentsData);
        }
      } catch (err) {
        setError('Failed to load knowledge path');
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledgePath();
  }, [pathId, user?.username]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const response = await commentsApi.addKnowledgePathComment(pathId, newComment);
      setComments([...comments, response]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (error) return <div className="text-red-500 text-center py-8">{error}</div>;
  if (!knowledgePath) return <div className="text-center py-8">Knowledge path not found</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{knowledgePath.title}</h1>
            <p className="text-gray-600">Created by {knowledgePath.author}</p>
          </div>
          <div className="flex items-center gap-4">
            <VoteComponent 
              type="knowledge_path"
              ids={{ pathId }}
              initialVoteCount={knowledgePath.vote_count}
              initialUserVote={knowledgePath.user_vote}
            />
            {isCreator && (
              <Link
                to={`/knowledge_path/${pathId}/edit`}
                className="bg-blue-500 hover:bg-blue-700 text-white !no-underline font-bold py-2 px-4 rounded transition-colors"
              >
                Edit Path
              </Link>
            )}
          </div>
        </div>

        {!isCreator && knowledgePath.progress && (
          <div className="mb-6">
            <div className="bg-gray-200 rounded-full h-4 mb-2">
              <div 
                className="bg-blue-500 rounded-full h-4 transition-all duration-500"
                style={{ width: `${knowledgePath.progress.percentage}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              Completed {knowledgePath.progress.completed_nodes} of {knowledgePath.progress.total_nodes} nodes
            </p>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Description</h2>
          <p className="text-gray-700">{knowledgePath.description}</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Content Nodes</h2>
            {knowledgePath.progress?.is_completed && (
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                Completed
              </span>
            )}
          </div>
          {knowledgePath.nodes?.length > 0 ? (
            <div className="space-y-4">
              {knowledgePath.nodes.map((node, index) => {
                return (
                  <div 
                    key={node.id}
                    className={`flex items-center p-4 rounded-lg border 
                      ${node.is_available ? 'bg-gray-50 border-gray-200' : 'bg-gray-100 border-gray-300'}`}
                  >
                    <span className="font-bold text-gray-500 mr-4">{index + 1}</span>
                    <div className="flex-grow">
                      {node.is_available ? (
                        <Link 
                          to={`/knowledge_path/${pathId}/nodes/${node.id}`}
                          className="font-medium hover:text-blue-500"
                        >
                          {node.title}
                        </Link>
                      ) : (
                        <span className="text-gray-500">{node.title}</span>
                      )}
                      <span className="text-sm text-gray-500 ml-2">{node.media_type}</span>
                    </div>
                    <div className="flex items-center">
                      {node.is_completed && <CheckCircle className="text-green-500 mr-2" />}
                      {!node.is_available && !isCreator && <Lock className="text-gray-500" />}
                      {node.is_available && !node.is_completed && <LockOpen className="text-blue-500" />}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500">No content nodes added yet</p>
          )}
        </div>

        {/* Comments Section */}
        {knowledgePath.progress?.is_completed && (
          <div className="mt-8 border-t pt-6">
            <CommentSection 
              knowledgePathId={pathId}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgePathDetail; 