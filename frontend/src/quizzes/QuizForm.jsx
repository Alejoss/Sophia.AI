import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import knowledgePathsApi from '../api/knowledgePathsApi';
import quizApi from '../api/quizzesApi';


const QuizForm = () => {
  const navigate = useNavigate();
  const { pathId: initialPathId, quizId } = useParams();
  const mode = quizId ? 'edit' : 'create';
  
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPathId, setCurrentPathId] = useState(initialPathId);
  
  const [quizData, setQuizData] = useState({
    title: '',
    description: '',
    precedingNodeId: '',
    questions: [],
    max_attempts_per_day: 2
  });

  useEffect(() => {
    const initializeForm = async () => {
      try {
        let pathIdToUse = initialPathId;
        console.log('Initializing form with path ID:', pathIdToUse);
        
        if (mode === 'edit' && quizId) {
          console.log('Edit mode - fetching quiz data for ID:', quizId);
          const quizData = await quizApi.getQuiz(quizId);
          console.log('Received quiz data:', quizData);
          
          if (!quizData.node) {
            console.error('Quiz is missing node information:', quizData);
            setError('Quiz is missing node information');
            return;
          }
          
          pathIdToUse = quizData.knowledge_path;
          console.log('Using path ID from quiz:', pathIdToUse);
          setCurrentPathId(pathIdToUse);
          
          // Ensure max_attempts_per_day is at least 2
          const maxAttempts = Math.max(2, parseInt(quizData.max_attempts_per_day) || 2);
          console.log('Initializing max_attempts_per_day:', maxAttempts);
          
          setQuizData({
            title: quizData.title,
            description: quizData.description,
            precedingNodeId: String(quizData.node),
            max_attempts_per_day: maxAttempts,
            questions: quizData.questions.map(q => ({
              text: q.text,
              questionType: q.question_type,
              options: q.options.map(opt => ({
                text: opt.text,
                isCorrect: opt.is_correct
              }))
            }))
          });
        }

        console.log('Fetching path data for ID:', pathIdToUse);
        const pathData = await knowledgePathsApi.getKnowledgePath(pathIdToUse);
        console.log('Received path data:', pathData);
        setNodes(pathData.nodes || []);
        console.log('Available nodes:', pathData.nodes);
      } catch (err) {
        console.error('Form initialization error:', err);
        console.error('Error details:', {
          response: err.response?.data,
          status: err.response?.status
        });
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    initializeForm();
  }, [quizId, initialPathId, mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Submitting quiz data:', quizData);
    console.log('Current path ID:', currentPathId);
    console.log('Initial path ID:', initialPathId);
    console.log('Selected node ID:', quizData.precedingNodeId);
    
    try {
      if (mode === 'create') {
        console.log('Creating new quiz with data:', {
          pathId: initialPathId,
          quizData: {
            ...quizData,
            node: quizData.precedingNodeId
          }
        });
        await quizApi.createQuiz(initialPathId, quizData);
      } else {
        console.log('Updating quiz with data:', {
          ...quizData,
          node: quizData.precedingNodeId
        });
        await quizApi.updateQuiz(quizId, {
          ...quizData,
          node: quizData.precedingNodeId
        });
      }
      navigate(`/knowledge_path/${currentPathId}/edit`);
    } catch (err) {
      console.error('Error details:', {
        response: err.response?.data,
        status: err.response?.status,
        headers: err.response?.headers
      });
      // Parse the error response
      let errorMessage = `Failed to ${mode} quiz`;
      
      if (err?.response?.data) {
        const errors = err.response.data;
        console.log('Received error data:', errors);
        // Convert validation errors into readable messages
        const errorMessages = Object.entries(errors).map(([field, messages]) => {
          // Convert field name to readable format (e.g., max_attempts_per_day -> Maximum Attempts Per Day)
          const readableField = field
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          // Handle both string and array messages
          const messageList = Array.isArray(messages) ? messages : [messages];
          return `${readableField}: ${messageList.join(', ')}`;
        });
        
        if (errorMessages.length > 0) {
          errorMessage = errorMessages.join('\n');
        }
      }
      
      setError(errorMessage);
    }
  };

  const handleAddQuestion = () => {
    setQuizData(prev => ({
      ...prev,
      questions: [...prev.questions, {
        text: '',
        questionType: 'SINGLE',
        options: [
          { text: '', isCorrect: true },
          { text: '', isCorrect: false }
        ]
      }]
    }));
  };

  const handleQuestionChange = (index, field, value) => {
    const updatedQuestions = [...quizData.questions];
    const question = updatedQuestions[index];
    
    if (field === 'questionType') {
      // When changing question type, ensure proper option selection
      if (value === 'SINGLE') {
        // For Single Choice, ensure exactly one option is correct
        const hasCorrectOption = question.options.some(opt => opt.isCorrect);
        if (!hasCorrectOption && question.options.length > 0) {
          // If no option is correct, make the first one correct
          question.options[0].isCorrect = true;
        }
      }
    }
    
    updatedQuestions[index] = { ...question, [field]: value };
    setQuizData(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const handleOptionChange = (questionIndex, optionIndex, field, value) => {
    const updatedQuestions = [...quizData.questions];
    const question = updatedQuestions[questionIndex];

    if (field === 'isCorrect' && question.questionType === 'SINGLE') {
      // For Single Choice, ensure exactly one option is correct
      if (value) {
        // If setting this option as correct, uncheck all others
        question.options.forEach((option, idx) => {
          option.isCorrect = idx === optionIndex;
        });
      } else {
        // If unchecking the only correct option, prevent it
        const correctOptionsCount = question.options.filter(opt => opt.isCorrect).length;
        if (correctOptionsCount <= 1) {
          return; // Don't allow unchecking if it's the only correct option
        }
      }
    }

    // Update the specific option
    question.options[optionIndex] = {
      ...question.options[optionIndex],
      [field]: value
    };

    setQuizData(prev => ({ ...prev, questions: updatedQuestions }));
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-4 bg-white">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/knowledge_path/${currentPathId}/edit`)}
          className="text-blue-500 hover:text-blue-700 mb-4 inline-block"
        >
          ← Back to Knowledge Path
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-4 text-gray-900">
        {mode === 'create' ? 'Create Quiz' : 'Edit Quiz'}
      </h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 whitespace-pre-line">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        <div>
          <label className="block text-gray-900 font-bold mb-2">
            Select Preceding Node
          </label>
          <select
            value={quizData.precedingNodeId}
            onChange={(e) => setQuizData(prev => ({ ...prev, precedingNodeId: e.target.value }))}
            required
            className="w-full p-2 border rounded text-gray-900"
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
          <label className="block text-gray-900 font-bold mb-2">
            Quiz Title
          </label>
          <input
            type="text"
            value={quizData.title}
            onChange={(e) => setQuizData(prev => ({ ...prev, title: e.target.value }))}
            required
            className="w-full p-2 border rounded text-gray-900"
          />
        </div>

        <div>
          <label className="block text-gray-900 font-bold mb-2">
            Quiz Description
          </label>
          <textarea
            value={quizData.description}
            onChange={(e) => setQuizData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full p-2 border rounded text-gray-900"
            rows="3"
          />
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-gray-900">Questions</h2>
          
          {quizData.questions.map((question, qIndex) => (
            <div key={qIndex} className="p-4 border rounded space-y-4">
              <div>
                <label className="block text-gray-900 font-bold mb-2">
                  Question Text
                </label>
                <textarea
                  value={question.text}
                  onChange={(e) => handleQuestionChange(qIndex, 'text', e.target.value)}
                  className="w-full p-2 border rounded text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-900 font-bold mb-2">
                  Question Type
                </label>
                <select
                  value={question.questionType}
                  onChange={(e) => handleQuestionChange(qIndex, 'questionType', e.target.value)}
                  className="w-full p-2 border rounded text-gray-900"
                >
                  <option value="SINGLE">Single Choice</option>
                  <option value="MULTIPLE">Multiple Choice</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-gray-900 font-bold mb-2">
                  Options
                </label>
                {question.options.map((option, oIndex) => (
                  <div key={oIndex} className="flex items-center space-x-2">
                    <input
                      type={question.questionType === 'SINGLE' ? 'radio' : 'checkbox'}
                      checked={option.isCorrect}
                      onChange={(e) => handleOptionChange(qIndex, oIndex, 'isCorrect', e.target.checked)}
                      name={`question-${qIndex}-correct`}
                      className="text-blue-600"
                    />
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => handleOptionChange(qIndex, oIndex, 'text', e.target.value)}
                      className="flex-1 p-2 border rounded text-gray-900"
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
          <label className="block text-gray-900 font-bold mb-2">
            Maximum Attempts Per Day
          </label>
          <select
            value={quizData.max_attempts_per_day}
            onChange={(e) => {
              const value = Math.max(2, parseInt(e.target.value) || 2);
              console.log('Selected max attempts:', value);
              setQuizData(prev => {
                const updated = { ...prev, max_attempts_per_day: value };
                console.log('Updated quiz data:', updated);
                return updated;
              });
            }}
            required
            className="w-full p-2 border rounded text-gray-900"
          >
            {[2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <option key={num} value={num}>
                {num} attempts
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-600 mt-1">
            Set how many times a student can attempt this quiz per day
          </p>
        </div>

        <div>
          <button
            type="submit"
            className="bg-blue-500 text-white px-6 py-2 rounded"
          >
            {mode === 'create' ? 'Create Quiz' : 'Update Quiz'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuizForm;
