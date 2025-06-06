import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import quizApi from '../api/quizzesApi';

const Quiz = () => {
    // TODO complete the quiz
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentAnswers, setCurrentAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [previousAttempts, setPreviousAttempts] = useState([]);
  const [quizResult, setQuizResult] = useState(null);
  const [hasPerfectScore, setHasPerfectScore] = useState(false);
  const [nextNode, setNextNode] = useState(null);
  const [attemptsExhausted, setAttemptsExhausted] = useState(false);
  const [lastAttemptAnswers, setLastAttemptAnswers] = useState({});

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const quizData = await quizApi.getQuiz(quizId);
        setQuiz(quizData);
        
        // Handle previous attempts
        if (quizData.user_attempts && quizData.user_attempts.length > 0) {
          setPreviousAttempts(quizData.user_attempts);
          
          // Check if attempts are exhausted for today
          const today = new Date().toDateString();
          const todayAttempts = quizData.user_attempts.filter(attempt => 
            new Date(attempt.completed_on).toDateString() === today
          ).length;
          
          if (todayAttempts >= quizData.max_attempts_per_day) {
            setAttemptsExhausted(true);
          }
        }

        // Set last attempt answers if available
        if (quizData.last_attempt && quizData.last_attempt.answers) {
          const answers = {};
          quizData.last_attempt.answers.forEach(answer => {
            answers[answer.question] = answer.selected_options;
          });
          setLastAttemptAnswers(answers);
        }

        // Check if user has a perfect score in previous attempts
        if (quizData.user_attempts && quizData.user_attempts.length > 0) {
          const perfectAttempt = quizData.user_attempts.find(attempt => attempt.score === 100);
          if (perfectAttempt) {
            setHasPerfectScore(true);
          }
        }

        // Initialize answers
        const initialAnswers = {};
        quizData.questions.forEach(question => {
          initialAnswers[question.id] = [];
        });
        setCurrentAnswers(initialAnswers);
      } catch (err) {
        setError('Failed to load quiz');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId]);

  const handleOptionSelect = (questionId, optionId, questionType) => {
    setCurrentAnswers(prev => {
      const newAnswers = { ...prev };
      if (questionType === 'SINGLE') {
        // For single choice, replace the array with the selected option
        newAnswers[questionId] = [optionId];
      } else {
        // For multiple choice, toggle the option
        if (newAnswers[questionId].includes(optionId)) {
          newAnswers[questionId] = newAnswers[questionId].filter(id => id !== optionId);
        } else {
          newAnswers[questionId] = [...newAnswers[questionId], optionId];
        }
      }
      return newAnswers;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate that all questions have been answered
    const unansweredQuestions = quiz.questions.filter(
      question => !currentAnswers[question.id]?.length
    );

    if (unansweredQuestions.length > 0) {
      setError('Please answer all questions before submitting');
      return;
    }

    setSubmitted(true);
    setError(null);
    
    try {
      const response = await quizApi.submitQuiz(quizId, {
        answers: currentAnswers
      });
      
      setQuizResult(response);
      
      if (response.attempt.score === 100) {
        setHasPerfectScore(true);
        if (response.next_node) {
          setNextNode(response.next_node);
        }
      }
      
    } catch (error) {
      const errorMessage = error.message || 'An unexpected error occurred';
      setError(errorMessage);
      setSubmitted(false);
    }
  };

  const handleNext = () => {
    if (quiz.next_node) {
      navigate(`/knowledge_path/${quiz.next_node.knowledge_path}/nodes/${quiz.next_node.id}`);
    } else {
      // If no next node (last node in path), go back to knowledge path
      navigate(`/knowledge_path/${quiz.knowledge_path}`);
    }
  };

  // Add UI to show previous attempts
  const renderPreviousAttempts = () => {
    if (previousAttempts.length === 0) return null;

    const today = new Date().toDateString();
    const todayAttempts = previousAttempts.filter(attempt => 
      new Date(attempt.completed_on).toDateString() === today
    );

    return (
      <div className={`mb-6 p-4 rounded-lg ${attemptsExhausted ? 'bg-red-50 border border-red-200' : 'bg-blue-50'}`}>
        <h2 className={`text-lg font-semibold ${attemptsExhausted ? 'text-red-700' : 'text-blue-700'}`}>
          Previous Attempts
        </h2>
        {previousAttempts.map((attempt, index) => (
          <div key={attempt.id} className="mt-2">
            <p className="text-gray-900">Attempt {index + 1}: Score {attempt.score}%</p>
            <p className="text-sm text-gray-600">
              Completed on: {new Date(attempt.completed_on).toLocaleDateString()}
            </p>
          </div>
        ))}
        {attemptsExhausted && (
          <div className="mt-4 p-3 bg-red-100 rounded border border-red-300">
            <p className="text-red-700 font-medium">
              You have reached the maximum number of attempts ({quiz.max_attempts_per_day}) for today.
              Please try again tomorrow.
            </p>
            <p className="text-sm text-red-600 mt-1">
              Today's attempts: {todayAttempts.length}/{quiz.max_attempts_per_day}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderQuizContent = () => {
    if (hasPerfectScore) {
      return (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Quiz Results</h2>
          <div className="text-center p-6 bg-green-50 rounded-lg mb-6 border border-green-300">
            <p className="text-4xl font-bold text-green-600 mb-2">
              Score: 100%
            </p>
            <p className="text-lg mb-4 text-gray-900">
              You have already successfully completed this quiz!
            </p>
            
            <div className="flex justify-center gap-4">
              <button
                onClick={() => navigate(`/knowledge_path/${quiz.knowledge_path}`)}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Go to Knowledge Path
              </button>
              {quiz.next_node && (
                <button
                  onClick={() => navigate(`/knowledge_path/${quiz.next_node.knowledge_path}/nodes/${quiz.next_node.id}`)}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Continue to Next Node: {quiz.next_node.title}
                </button>
              )}
            </div>
          </div>

          {quiz.questions.map((question, index) => (
            <div key={question.id} className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-gray-900">
                {index + 1}. {question.text}
              </h3>
              
              {question.image && (
                <div className="mb-4">
                  <img 
                    src={question.image} 
                    alt={question.image_description || 'Question image'} 
                    className="max-w-full h-auto rounded"
                  />
                </div>
              )}

              <div className="space-y-2">
                {question.options.map(option => {
                  const isCorrect = question.correct_answers.includes(option.id);
                  const wasSelected = lastAttemptAnswers[question.id]?.includes(option.id);
                  
                  let optionClassName = "flex items-center p-3 border rounded text-gray-900";
                  if (wasSelected) {
                    optionClassName += isCorrect ? " bg-green-50 border-green-300" : " bg-red-50 border-red-300";
                  }

                  return (
                    <div key={option.id} className={optionClassName}>
                      <div className="mr-3">
                        {wasSelected && (
                          isCorrect ? 
                            <span className="text-green-600">✓</span> : 
                            <span className="text-red-600">✗</span>
                        )}
                      </div>
                      <span>{option.text}</span>
                      {wasSelected && (
                        <span className={`ml-auto text-sm ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                          {isCorrect ? 'Correct' : 'Incorrect'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (submitted && quizResult) {
      const isPerfectScore = quizResult.attempt.score === 100;
      const bgColor = isPerfectScore ? 'bg-green-50' : 'bg-red-50';
      const textColor = isPerfectScore ? 'text-green-600' : 'text-red-600';
      const borderColor = isPerfectScore ? 'border-green-300' : 'border-red-300';

      return (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Quiz Results</h2>
          <div className={`text-center p-6 ${bgColor} rounded-lg mb-6 border ${borderColor}`}>
            <p className={`text-4xl font-bold ${textColor} mb-2`}>
              Score: {quizResult.attempt.score}%
            </p>
            {isPerfectScore ? (
              <>
                <p className="text-lg mb-4 text-gray-900">
                  Congratulations! You have successfully completed this quiz.
                </p>
                {quizResult.next_node && (
                  <p className="text-sm mb-4 text-gray-700">
                    Redirecting to next node in 10 seconds...
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-lg mb-2 text-gray-900">
                  You got {quizResult.correct_answers} out of {quizResult.total_questions} questions correct.
                </p>
                <p className="text-lg mb-4 text-gray-900">
                  Attempts remaining today: {quizResult.attempts_remaining}
                </p>
              </>
            )}
            <button
              onClick={() => navigate(-1)}
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
              Return to Previous Page
            </button>
          </div>

          {quiz.questions.map((question, index) => (
            <div key={question.id} className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-gray-900">
                {index + 1}. {question.text}
              </h3>
              
              {question.image && (
                <div className="mb-4">
                  <img 
                    src={question.image} 
                    alt={question.image_description || 'Question image'} 
                    className="max-w-full h-auto rounded"
                  />
                </div>
              )}

              <div className="space-y-2">
                {question.options.map(option => {
                  const isCorrect = question.correct_answers.includes(option.id);
                  const wasSelected = currentAnswers[question.id]?.includes(option.id);
                  
                  let optionClassName = "flex items-center p-3 border rounded text-gray-900";
                  if (wasSelected) {
                    optionClassName += isCorrect ? " bg-green-50 border-green-300" : " bg-red-50 border-red-300";
                  }

                  return (
                    <div key={option.id} className={optionClassName}>
                      <div className="mr-3">
                        {wasSelected && (
                          isCorrect ? 
                            <span className="text-green-600">✓</span> : 
                            <span className="text-red-600">✗</span>
                        )}
                      </div>
                      <span>{option.text}</span>
                      {wasSelected && (
                        <span className={`ml-auto text-sm ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                          {isCorrect ? 'Correct' : 'Incorrect'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit}>
        {quiz.questions.map((question, index) => (
          <div key={question.id} className="mb-8 p-4 bg-white rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">
              {index + 1}. {question.text}
            </h2>
            
            {question.image && (
              <div className="mb-4">
                <img 
                  src={question.image} 
                  alt={question.image_description || 'Question image'} 
                  className="max-w-full h-auto rounded"
                />
              </div>
            )}

            <div className="space-y-2">
              {question.options.map(option => (
                <label 
                  key={option.id} 
                  className={`flex items-center p-3 border rounded text-gray-900 ${
                    attemptsExhausted ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <input
                    type={question.question_type === 'SINGLE' ? 'radio' : 'checkbox'}
                    name={`question-${question.id}`}
                    value={option.id}
                    checked={currentAnswers[question.id]?.includes(option.id)}
                    onChange={() => handleOptionSelect(question.id, option.id, question.question_type)}
                    className="mr-3"
                    disabled={submitted || hasPerfectScore || attemptsExhausted}
                  />
                  <span>{option.text}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="mt-6 flex gap-4">
          <button
            type="submit"
            className={`font-bold py-2 px-4 rounded ${
              attemptsExhausted 
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-700 text-white'
            }`}
            disabled={submitted || attemptsExhausted}
          >
            {attemptsExhausted ? 'No Attempts Remaining' : 'Submit Quiz'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 px-4 rounded"
          >
            Back
          </button>
        </div>
      </form>
    );
  };

  if (loading) return <div className="container mx-auto p-4 text-gray-900">Loading...</div>;
  if (!quiz) return <div className="container mx-auto p-4 text-gray-900">Quiz not found</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        {/* Error Message Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 font-medium">{error}</p>
          </div>
        )}

        <h1 className="text-2xl font-bold mb-6 text-gray-900">{quiz.title}</h1>
        {quiz.description && (
          <p className="text-gray-700 mb-6">{quiz.description}</p>
        )}

        {/* Show previous attempts */}
        {renderPreviousAttempts()}

        {/* Render quiz content based on completion status */}
        {renderQuizContent()}
      </div>
    </div>
  );
};

export default Quiz;
