import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';
import quizApi from '../api/quizApi';

const QuizCreate = () => {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Quiz form state
  const [quizData, setQuizData] = useState({
    title: '',
    description: '',
    precedingNodeId: '',
    questions: []
  });

  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const data = await knowledgePathsApi.getKnowledgePath(pathId);
        setNodes(data.nodes || []);
      } catch (err) {
        setError('Failed to load knowledge path nodes');
      } finally {
        setLoading(false);
      }
    };
    fetchNodes();
  }, [pathId]);

  const handleAddQuestion = () => {
    setQuizData(prev => ({
      ...prev,
      questions: [...prev.questions, {
        text: '',
        questionType: 'SINGLE',
        image: null,
        imageDescription: '',
        options: [
          { text: '', isCorrect: false },
          { text: '', isCorrect: false }
        ]
      }]
    }));
  };

  const handleQuestionChange = (index, field, value) => {
    const updatedQuestions = [...quizData.questions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setQuizData(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const handleOptionChange = (questionIndex, optionIndex, field, value) => {
    const updatedQuestions = [...quizData.questions];
    updatedQuestions[questionIndex].options[optionIndex] = {
      ...updatedQuestions[questionIndex].options[optionIndex],
      [field]: value
    };
    setQuizData(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await quizApi.createQuiz(pathId, quizData);
      navigate(`/knowledge-paths/${pathId}/edit`);
    } catch (err) {
      setError(err.message || 'Failed to create quiz');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Create Quiz</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-gray-700 font-bold mb-2">
            Select Preceding Node
          </label>
          <select
            value={quizData.precedingNodeId}
            onChange={(e) => setQuizData(prev => ({ ...prev, precedingNodeId: e.target.value }))}
            required
            className="w-full p-2 border rounded"
          >
            <option value="">Select a node...</option>
            {nodes.map(node => (
              <option key={node.id} value={node.id}>
                {node.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-gray-700 font-bold mb-2">
            Quiz Title
          </label>
          <input
            type="text"
            value={quizData.title}
            onChange={(e) => setQuizData(prev => ({ ...prev, title: e.target.value }))}
            required
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-bold mb-2">
            Quiz Description
          </label>
          <textarea
            value={quizData.description}
            onChange={(e) => setQuizData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full p-2 border rounded"
            rows="3"
          />
        </div>

        {/* Questions Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold">Questions</h2>
          
          {quizData.questions.map((question, qIndex) => (
            <div key={qIndex} className="p-4 border rounded space-y-4">
              <div>
                <label className="block text-gray-700 font-bold mb-2">
                  Question Text
                </label>
                <textarea
                  value={question.text}
                  onChange={(e) => handleQuestionChange(qIndex, 'text', e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-2">
                  Question Type
                </label>
                <select
                  value={question.questionType}
                  onChange={(e) => handleQuestionChange(qIndex, 'questionType', e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="SINGLE">Single Choice</option>
                  <option value="MULTIPLE">Multiple Choice</option>
                </select>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="block text-gray-700 font-bold mb-2">
                  Options
                </label>
                {question.options.map((option, oIndex) => (
                  <div key={oIndex} className="flex items-center space-x-2">
                    <input
                      type={question.questionType === 'SINGLE' ? 'radio' : 'checkbox'}
                      checked={option.isCorrect}
                      onChange={(e) => handleOptionChange(qIndex, oIndex, 'isCorrect', e.target.checked)}
                      name={`question-${qIndex}-correct`}
                    />
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => handleOptionChange(qIndex, oIndex, 'text', e.target.value)}
                      className="flex-1 p-2 border rounded"
                      placeholder="Option text"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updatedQuestions = [...quizData.questions];
                        updatedQuestions[qIndex].options = updatedQuestions[qIndex].options.filter((_, i) => i !== oIndex);
                        setQuizData(prev => ({ ...prev, questions: updatedQuestions }));
                      }}
                      className="text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const updatedQuestions = [...quizData.questions];
                    updatedQuestions[qIndex].options.push({ text: '', isCorrect: false });
                    setQuizData(prev => ({ ...prev, questions: updatedQuestions }));
                  }}
                  className="text-blue-600"
                >
                  Add Option
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddQuestion}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Add Question
          </button>
        </div>

        <div>
          <button
            type="submit"
            className="bg-blue-500 text-white px-6 py-2 rounded"
          >
            Create Quiz
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuizCreate; 