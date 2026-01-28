import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Card,
  CardContent,
  Divider,
  Radio,
  RadioGroup,
  FormControlLabel,
  Checkbox,
  IconButton,
  Chip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import QuizIcon from '@mui/icons-material/Quiz';
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
  const [submitting, setSubmitting] = useState(false);
  
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
            setError('Al cuestionario le falta información del nodo');
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
        setError('Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    };

    initializeForm();
  }, [quizId, initialPathId, mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
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
      let errorMessage = `Error al ${mode === 'create' ? 'crear' : 'actualizar'} el cuestionario`;
      
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
    } finally {
      setSubmitting(false);
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

  const handleRemoveOption = (questionIndex, optionIndex) => {
    const updatedQuestions = [...quizData.questions];
    updatedQuestions[questionIndex].options = updatedQuestions[questionIndex].options.filter((_, i) => i !== optionIndex);
    setQuizData(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const handleAddOption = (questionIndex) => {
    const updatedQuestions = [...quizData.questions];
    updatedQuestions[questionIndex].options.push({ text: '', isCorrect: false });
    setQuizData(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const handleRemoveQuestion = (questionIndex) => {
    const updatedQuestions = quizData.questions.filter((_, i) => i !== questionIndex);
    setQuizData(prev => ({ ...prev, questions: updatedQuestions }));
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        {/* Header with Back Button */}
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(`/knowledge_path/${currentPathId}/edit`)}
            sx={{ textTransform: 'none', mb: 2 }}
          >
            Volver al Camino de Conocimiento
          </Button>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            {mode === 'create' ? 'Crear Cuestionario' : 'Editar Cuestionario'}
          </Typography>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>
            {error}
          </Alert>
        )}

        {/* Form */}
        <Paper elevation={1} sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
          <form onSubmit={handleSubmit}>
            <Stack spacing={4}>
              {/* Preceding Node Selection */}
              <FormControl fullWidth required>
                <InputLabel id="preceding-node-label">Seleccionar Nodo Precedente</InputLabel>
                <Select
                  labelId="preceding-node-label"
                  id="preceding-node"
                  value={quizData.precedingNodeId}
                  label="Seleccionar Nodo Precedente"
                  onChange={(e) => setQuizData(prev => ({ ...prev, precedingNodeId: e.target.value }))}
                >
                  <MenuItem value="">
                    <em>Seleccionar un nodo...</em>
                  </MenuItem>
                  {nodes.map(node => (
                    <MenuItem key={node.id} value={node.id}>
                      {node.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Quiz Title */}
              <TextField
                fullWidth
                required
                label="Título del Cuestionario"
                value={quizData.title}
                onChange={(e) => setQuizData(prev => ({ ...prev, title: e.target.value }))}
                variant="outlined"
              />

              {/* Quiz Description */}
              <TextField
                fullWidth
                label="Descripción del Cuestionario"
                value={quizData.description}
                onChange={(e) => setQuizData(prev => ({ ...prev, description: e.target.value }))}
                variant="outlined"
                multiline
                rows={3}
              />

              <Divider />

              {/* Questions Section */}
              <Box>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                  <QuizIcon color="primary" />
                  <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                    Preguntas
                  </Typography>
                  {quizData.questions.length > 0 && (
                    <Chip label={`${quizData.questions.length} pregunta(s)`} size="small" color="primary" variant="outlined" />
                  )}
                </Stack>

                <Stack spacing={3}>
                  {quizData.questions.map((question, qIndex) => (
                    <Card key={qIndex} variant="outlined" sx={{ borderRadius: 2 }}>
                      <CardContent>
                        <Stack spacing={3}>
                          {/* Question Header */}
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              Pregunta {qIndex + 1}
                            </Typography>
                            {quizData.questions.length > 1 && (
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveQuestion(qIndex)}
                                aria-label="Eliminar pregunta"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Stack>

                          {/* Question Text */}
                          <TextField
                            fullWidth
                            required
                            label="Texto de la Pregunta"
                            value={question.text}
                            onChange={(e) => handleQuestionChange(qIndex, 'text', e.target.value)}
                            variant="outlined"
                            multiline
                            rows={2}
                          />

                          {/* Question Type */}
                          <FormControl fullWidth>
                            <InputLabel id={`question-type-${qIndex}-label`}>Tipo de Pregunta</InputLabel>
                            <Select
                              labelId={`question-type-${qIndex}-label`}
                              id={`question-type-${qIndex}`}
                              value={question.questionType}
                              label="Tipo de Pregunta"
                              onChange={(e) => handleQuestionChange(qIndex, 'questionType', e.target.value)}
                            >
                              <MenuItem value="SINGLE">Opción Única</MenuItem>
                              <MenuItem value="MULTIPLE">Opción Múltiple</MenuItem>
                            </Select>
                          </FormControl>

                          <Divider />

                          {/* Options */}
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                              Opciones
                            </Typography>
                            <Stack spacing={2}>
                              {question.options.map((option, oIndex) => (
                                <Stack key={oIndex} direction="row" spacing={2} alignItems="flex-start">
                                  {question.questionType === 'SINGLE' ? (
                                    <Radio
                                      checked={option.isCorrect}
                                      onChange={(e) => handleOptionChange(qIndex, oIndex, 'isCorrect', e.target.checked)}
                                      name={`question-${qIndex}-correct`}
                                      sx={{ mt: 0.5 }}
                                    />
                                  ) : (
                                    <Checkbox
                                      checked={option.isCorrect}
                                      onChange={(e) => handleOptionChange(qIndex, oIndex, 'isCorrect', e.target.checked)}
                                      sx={{ mt: 0.5 }}
                                    />
                                  )}
                                  <TextField
                                    fullWidth
                                    required
                                    size="small"
                                    placeholder="Texto de la opción"
                                    value={option.text}
                                    onChange={(e) => handleOptionChange(qIndex, oIndex, 'text', e.target.value)}
                                    variant="outlined"
                                  />
                                  {question.options.length > 2 && (
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => handleRemoveOption(qIndex, oIndex)}
                                      aria-label="Eliminar opción"
                                      sx={{ mt: 0.5 }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  )}
                                </Stack>
                              ))}
                              <Button
                                startIcon={<AddIcon />}
                                onClick={() => handleAddOption(qIndex)}
                                variant="outlined"
                                size="small"
                                sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
                              >
                                Agregar Opción
                              </Button>
                            </Stack>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Add Question Button */}
                  <Button
                    startIcon={<AddIcon />}
                    onClick={handleAddQuestion}
                    variant="outlined"
                    color="success"
                    sx={{ textTransform: 'none' }}
                  >
                    Agregar Pregunta
                  </Button>
                </Stack>
              </Box>

              <Divider />

              {/* Max Attempts per Day */}
              <FormControl fullWidth required>
                <InputLabel id="max-attempts-label">Intentos Máximos por Día</InputLabel>
                <Select
                  labelId="max-attempts-label"
                  id="max-attempts"
                  value={quizData.max_attempts_per_day}
                  label="Intentos Máximos por Día"
                  onChange={(e) => {
                    const value = Math.max(2, parseInt(e.target.value) || 2);
                    setQuizData(prev => ({ ...prev, max_attempts_per_day: value }));
                  }}
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <MenuItem key={num} value={num}>
                      {num} intentos
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Establezca cuántas veces un estudiante puede intentar este cuestionario por día
                </FormHelperText>
              </FormControl>

              {/* Submit Button */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 2 }}>
                <Button
                  onClick={() => navigate(`/knowledge_path/${currentPathId}/edit`)}
                  variant="outlined"
                  sx={{ textTransform: 'none' }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={submitting}
                  sx={{ textTransform: 'none' }}
                >
                  {submitting ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      {mode === 'create' ? 'Creando...' : 'Actualizando...'}
                    </>
                  ) : (
                    mode === 'create' ? 'Crear Cuestionario' : 'Actualizar Cuestionario'
                  )}
                </Button>
              </Box>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </Container>
  );
};

export default QuizForm;
