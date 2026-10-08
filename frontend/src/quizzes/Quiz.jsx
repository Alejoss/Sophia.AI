import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Stack,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import quizApi from '../api/quizzesApi';
import { parseApiValidationErrors } from '../utils/apiFormErrors';
import { useDateLocales } from '../hooks/useDateLocales';

const Quiz = () => {
    // TODO complete the quiz
  const { t } = useTranslation('quizzes');
  const { intl } = useDateLocales();
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
        setError(t('loadError'));
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId, t]);

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
      setError(t('answerAll'));
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
      const { generalError } = parseApiValidationErrors(
        error,
        t('submitError'),
      );
      setError(generalError || t('submitError'));
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

  const renderPreviousAttempts = () => {
    if (previousAttempts.length === 0) return null;

    const today = new Date().toDateString();
    const todayAttempts = previousAttempts.filter(attempt => 
      new Date(attempt.completed_on).toDateString() === today
    );

    const severity = attemptsExhausted ? 'error' : 'info';

    return (
      <Box sx={{ mb: 3 }}>
        <Alert
          severity={severity}
          sx={{ borderRadius: 2, alignItems: 'flex-start' }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              {t('previousAttempts')}
            </Typography>
            <Stack spacing={1}>
              {previousAttempts.map((attempt, index) => (
                <Typography key={attempt.id} variant="body2">
                  {t('attemptLine', {
                    index: index + 1,
                    score: attempt.score,
                    date: new Date(attempt.completed_on).toLocaleDateString(intl),
                  })}
                </Typography>
              ))}
            </Stack>
            {attemptsExhausted && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t('attemptsExhausted', { count: quiz.max_attempts_per_day })}
                </Typography>
                <Typography variant="caption">
                  {t('attemptsToday', {
                    used: todayAttempts.length,
                    max: quiz.max_attempts_per_day,
                  })}
                </Typography>
              </Box>
            )}
          </Box>
        </Alert>
      </Box>
    );
  };

  const renderQuizContent = () => {
    if (hasPerfectScore) {
      return (
        <Stack spacing={3}>
          <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
              {t('resultsTitle')}
            </Typography>
            <Alert
              severity="success"
              sx={{ mb: 2, borderRadius: 2, alignItems: 'center' }}
            >
              <Box sx={{ textAlign: 'center', width: '100%' }}>
                <Typography
                  variant="h3"
                  component="p"
                  sx={{ fontWeight: 700, mb: 1 }}
                >
                  {t('score', { score: 100 })}
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {t('alreadyCompleted')}
                </Typography>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  justifyContent="center"
                >
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() =>
                      navigate(`/knowledge_path/${quiz.knowledge_path}`)
                    }
                  >
                    {t('goToPath')}
                  </Button>
                  {quiz.next_node && (
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={() =>
                        navigate(
                          `/knowledge_path/${quiz.next_node.knowledge_path}/nodes/${quiz.next_node.id}`,
                        )
                      }
                    >
                      {t('continueNext', { title: quiz.next_node.title })}
                    </Button>
                  )}
                </Stack>
              </Box>
            </Alert>
          </Paper>

          {quiz.questions.map((question, index) => (
            <Card key={question.id} variant="outlined">
              <CardContent>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, mb: 1.5 }}
                >
                  {index + 1}. {question.text}
                </Typography>

                {question.image && (
                  <Box sx={{ mb: 2 }}>
                    <img
                      src={question.image}
                      alt={
                        question.image_description || t('questionImageAlt')
                      }
                      style={{ maxWidth: '100%', height: 'auto', borderRadius: 8 }}
                    />
                  </Box>
                )}

                <Stack spacing={1.5}>
                  {question.options.map(option => {
                    const isCorrect = question.correct_answers.includes(
                      option.id,
                    );
                    const wasSelected =
                      lastAttemptAnswers[question.id]?.includes(option.id);

                    return (
                      <Paper
                        key={option.id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          borderColor: wasSelected
                            ? isCorrect
                              ? 'success.light'
                              : 'error.light'
                            : 'divider',
                          bgcolor: wasSelected
                            ? isCorrect
                              ? 'success.lighter'
                              : 'error.lighter'
                            : 'background.paper',
                        }}
                      >
                        {wasSelected && (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {isCorrect ? (
                              <CheckIcon color="success" fontSize="small" />
                            ) : (
                              <CloseIcon color="error" fontSize="small" />
                            )}
                          </Box>
                        )}
                        <Typography variant="body2">{option.text}</Typography>
                        {wasSelected && (
                          <Chip
                            label={isCorrect ? t('correctAnswer') : t('incorrectAnswer')}
                            color={isCorrect ? 'success' : 'error'}
                            size="small"
                            sx={{ ml: 'auto' }}
                          />
                        )}
                      </Paper>
                    );
                  })}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      );
    }

    if (submitted && quizResult) {
      const isPerfectScore = quizResult.attempt.score === 100;
      return (
        <Stack spacing={3}>
          <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
              {t('resultsTitle')}
            </Typography>
            <Alert
              severity={isPerfectScore ? 'success' : 'warning'}
              sx={{ mb: 2, borderRadius: 2, alignItems: 'center' }}
            >
              <Box sx={{ textAlign: 'center', width: '100%' }}>
                <Typography
                  variant="h3"
                  component="p"
                  sx={{ fontWeight: 700, mb: 1 }}
                >
                  {t('score', { score: quizResult.attempt.score })}
                </Typography>
                {isPerfectScore ? (
                  <>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {t('congratulations')}
                    </Typography>
                    {quizResult.next_node && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {t('redirecting')}
                      </Typography>
                    )}
                  </>
                ) : (
                  <>
                    <Typography variant="body1">
                      {t('correctCount', {
                        correct: quizResult.correct_answers,
                        total: quizResult.total_questions,
                      })}
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 0.5 }}>
                      {t('attemptsRemaining', { count: quizResult.attempts_remaining })}
                    </Typography>
                  </>
                )}
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => navigate(-1)}
                  >
                    {t('backToPrevious')}
                  </Button>
                </Box>
              </Box>
            </Alert>
          </Paper>

          {quiz.questions.map((question, index) => (
            <Card key={question.id} variant="outlined">
              <CardContent>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, mb: 1.5 }}
                >
                  {index + 1}. {question.text}
                </Typography>

                {question.image && (
                  <Box sx={{ mb: 2 }}>
                    <img
                      src={question.image}
                      alt={
                        question.image_description || t('questionImageAlt')
                      }
                      style={{ maxWidth: '100%', height: 'auto', borderRadius: 8 }}
                    />
                  </Box>
                )}

                <Stack spacing={1.5}>
                  {question.options.map(option => {
                    const isCorrect = question.correct_answers.includes(
                      option.id,
                    );
                    const wasSelected =
                      currentAnswers[question.id]?.includes(option.id);

                    return (
                      <Paper
                        key={option.id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          borderColor: wasSelected
                            ? isCorrect
                              ? 'success.light'
                              : 'error.light'
                            : 'divider',
                          bgcolor: wasSelected
                            ? isCorrect
                              ? 'success.lighter'
                              : 'error.lighter'
                            : 'background.paper',
                        }}
                      >
                        {wasSelected && (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {isCorrect ? (
                              <CheckIcon color="success" fontSize="small" />
                            ) : (
                              <CloseIcon color="error" fontSize="small" />
                            )}
                          </Box>
                        )}
                        <Typography variant="body2">{option.text}</Typography>
                        {wasSelected && (
                          <Chip
                            label={isCorrect ? t('correctAnswer') : t('incorrectAnswer')}
                            color={isCorrect ? 'success' : 'error'}
                            size="small"
                            sx={{ ml: 'auto' }}
                          />
                        )}
                      </Paper>
                    );
                  })}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      );
    }

    return (
      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        {quiz.questions.map((question, index) => (
          <Card key={question.id} variant="outlined">
            <CardContent>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, mb: 1.5 }}
              >
                {index + 1}. {question.text}
              </Typography>

              {question.image && (
                <Box sx={{ mb: 2 }}>
                  <img
                    src={question.image}
                      alt={question.image_description || t('questionImageAlt')}
                    style={{ maxWidth: '100%', height: 'auto', borderRadius: 8 }}
                  />
                </Box>
              )}

              <Stack spacing={1.5}>
                {question.options.map(option => {
                  const isSelected =
                    currentAnswers[question.id]?.includes(option.id);

                  return (
                    <Paper
                      key={option.id}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        cursor:
                          submitted || hasPerfectScore || attemptsExhausted
                            ? 'default'
                            : 'pointer',
                        opacity:
                          submitted || hasPerfectScore || attemptsExhausted
                            ? 0.7
                            : 1,
                        bgcolor: isSelected ? 'action.hover' : 'background.paper',
                      }}
                      onClick={() =>
                        !submitted &&
                        !hasPerfectScore &&
                        !attemptsExhausted &&
                        handleOptionSelect(
                          question.id,
                          option.id,
                          question.question_type,
                        )
                      }
                    >
                      <input
                        type={
                          question.question_type === 'SINGLE'
                            ? 'radio'
                            : 'checkbox'
                        }
                        name={`question-${question.id}`}
                        value={option.id}
                        checked={isSelected}
                        onChange={() =>
                          handleOptionSelect(
                            question.id,
                            option.id,
                            question.question_type,
                          )
                        }
                        disabled={submitted || hasPerfectScore || attemptsExhausted}
                        style={{ marginRight: 8 }}
                      />
                      <Typography variant="body2">{option.text}</Typography>
                    </Paper>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        ))}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ mt: 1 }}
        >
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={submitted || attemptsExhausted}
            sx={{ minWidth: { xs: '100%', sm: 200 } }}
          >
            {attemptsExhausted ? t('noAttemptsLeft') : t('submit')}
          </Button>
          <Button
            type="button"
            variant="outlined"
            color="inherit"
            onClick={() => navigate(-1)}
            sx={{ minWidth: { xs: '100%', sm: 160 } }}
          >
            {t('back')}
          </Button>
        </Stack>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '60vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!quiz) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{t('notFound')}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        <Paper elevation={1} sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Stack spacing={1.5} sx={{ mb: 2 }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              {quiz.title}
            </Typography>
            {quiz.description && (
              <Typography variant="body1">{quiz.description}</Typography>
            )}
            <Chip
              label={t('maxAttemptsChip', { count: quiz.max_attempts_per_day })}
              size="small"
            />
          </Stack>

          {renderPreviousAttempts()}

          {renderQuizContent()}
        </Paper>
      </Box>
    </Container>
  );
};

export default Quiz;
