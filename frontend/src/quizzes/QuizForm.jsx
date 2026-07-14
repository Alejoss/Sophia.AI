import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
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
  Checkbox,
  IconButton,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import QuizIcon from '@mui/icons-material/Quiz';
import knowledgePathsApi from '../api/knowledgePathsApi';
import quizApi from '../api/quizzesApi';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';

const schema = yup.object({
  title: yup
    .string()
    .trim()
    .required('El título es requerido.'),
  description: yup.string().trim().default(''),
  precedingNodeId: yup
    .mixed()
    .test('required', 'Debes seleccionar un nodo precedente.', (value) => value != null && value !== ''),
  max_attempts_per_day: yup
    .number()
    .typeError('Los intentos máximos deben ser un número.')
    .min(2, 'El mínimo es 2 intentos por día.')
    .max(9, 'El máximo es 9 intentos por día.')
    .required('Los intentos máximos por día son requeridos.'),
});

const DEFAULT_QUESTION = {
  text: '',
  questionType: 'SINGLE',
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
  ],
};

const API_FIELD_MAP = {
  node: 'precedingNodeId',
  node_id: 'precedingNodeId',
};

function validateQuestions(questions) {
  const messages = [];

  questions.forEach((question, qIndex) => {
    const label = `Pregunta ${qIndex + 1}`;

    if (!question.text?.trim()) {
      messages.push(`${label}: el texto es requerido.`);
    }

    if (!question.options || question.options.length < 2) {
      messages.push(`${label}: debe tener al menos 2 opciones.`);
    }

    question.options?.forEach((option, oIndex) => {
      if (!option.text?.trim()) {
        messages.push(`${label}, opción ${oIndex + 1}: el texto es requerido.`);
      }
    });

    const hasCorrect = question.options?.some((opt) => opt.isCorrect);
    if (!hasCorrect) {
      messages.push(`${label}: debe tener al menos una respuesta correcta.`);
    }
  });

  return messages;
}

const QuizForm = () => {
  const navigate = useNavigate();
  const { pathId: initialPathId, quizId } = useParams();
  const mode = quizId ? 'edit' : 'create';

  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [questionsError, setQuestionsError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [currentPathId, setCurrentPathId] = useState(initialPathId);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingQuiz, setIsDeletingQuiz] = useState(false);
  const [questions, setQuestions] = useState([]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      precedingNodeId: '',
      max_attempts_per_day: 2,
    },
  });

  const title = watch('title');

  useEffect(() => {
    const initializeForm = async () => {
      try {
        let pathIdToUse = initialPathId;

        if (mode === 'edit' && quizId) {
          const fetchedQuiz = await quizApi.getQuiz(quizId);

          if (!fetchedQuiz.node) {
            console.error('Quiz is missing node information:', fetchedQuiz);
            setLoadError('Al cuestionario le falta información del nodo');
            return;
          }

          pathIdToUse = fetchedQuiz.knowledge_path;
          setCurrentPathId(pathIdToUse);

          const maxAttempts = Math.max(2, parseInt(fetchedQuiz.max_attempts_per_day, 10) || 2);

          reset({
            title: fetchedQuiz.title,
            description: fetchedQuiz.description || '',
            precedingNodeId: String(fetchedQuiz.node),
            max_attempts_per_day: maxAttempts,
          });

          setQuestions(
            fetchedQuiz.questions.map((q) => ({
              text: q.text,
              questionType: q.question_type,
              options: q.options.map((opt) => ({
                text: opt.text,
                isCorrect: opt.is_correct,
              })),
            })),
          );
        }

        const pathData = await knowledgePathsApi.getKnowledgePath(pathIdToUse);
        setNodes(pathData.nodes || []);
      } catch (err) {
        console.error('Form initialization error:', err);
        console.error('Error details:', {
          response: err.response?.data,
          status: err.response?.status,
        });
        setLoadError('Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    };

    initializeForm();
  }, [quizId, initialPathId, mode, reset]);

  const onSubmit = async (formValues) => {
    setSubmitError(null);
    setQuestionsError(null);
    setDeleteError(null);

    const questionMessages = validateQuestions(questions);
    if (questionMessages.length > 0) {
      setQuestionsError(questionMessages.join('\n'));
      return;
    }

    const quizData = {
      ...formValues,
      questions,
    };

    try {
      if (mode === 'create') {
        await quizApi.createQuiz(initialPathId, quizData);
      } else {
        await quizApi.updateQuiz(quizId, {
          ...quizData,
          node: formValues.precedingNodeId,
        });
      }
      navigate(`/knowledge_path/${currentPathId}/edit`);
    } catch (err) {
      console.error('Error details:', {
        response: err.response?.data,
        status: err.response?.status,
        headers: err.response?.headers,
      });

      const fallback = `Error al ${mode === 'create' ? 'crear' : 'actualizar'} el cuestionario`;
      const { generalError } = applyApiErrorsToForm(
        err,
        setError,
        fallback,
        API_FIELD_MAP,
      );
      setSubmitError(generalError);
    }
  };

  const handleAddQuestion = () => {
    setQuestions((prev) => [...prev, { ...DEFAULT_QUESTION, options: DEFAULT_QUESTION.options.map((o) => ({ ...o })) }]);
    setQuestionsError(null);
  };

  const handleQuestionChange = (index, field, value) => {
    setQuestions((prev) => {
      const updatedQuestions = [...prev];
      const question = { ...updatedQuestions[index], [field]: value };

      if (field === 'questionType' && value === 'SINGLE') {
        const hasCorrectOption = question.options.some((opt) => opt.isCorrect);
        if (!hasCorrectOption && question.options.length > 0) {
          question.options = question.options.map((opt, idx) => ({
            ...opt,
            isCorrect: idx === 0,
          }));
        }
      }

      updatedQuestions[index] = question;
      return updatedQuestions;
    });
    setQuestionsError(null);
  };

  const handleOptionChange = (questionIndex, optionIndex, field, value) => {
    setQuestions((prev) => {
      const updatedQuestions = [...prev];
      const question = { ...updatedQuestions[questionIndex], options: [...updatedQuestions[questionIndex].options] };

      if (field === 'isCorrect' && question.questionType === 'SINGLE') {
        if (value) {
          question.options = question.options.map((option, idx) => ({
            ...option,
            isCorrect: idx === optionIndex,
          }));
        } else {
          const correctOptionsCount = question.options.filter((opt) => opt.isCorrect).length;
          if (correctOptionsCount <= 1) {
            return prev;
          }
          question.options[optionIndex] = { ...question.options[optionIndex], isCorrect: false };
        }
      } else {
        question.options[optionIndex] = {
          ...question.options[optionIndex],
          [field]: value,
        };
      }

      updatedQuestions[questionIndex] = question;
      return updatedQuestions;
    });
    setQuestionsError(null);
  };

  const handleRemoveOption = (questionIndex, optionIndex) => {
    setQuestions((prev) => {
      const updatedQuestions = [...prev];
      updatedQuestions[questionIndex] = {
        ...updatedQuestions[questionIndex],
        options: updatedQuestions[questionIndex].options.filter((_, i) => i !== optionIndex),
      };
      return updatedQuestions;
    });
    setQuestionsError(null);
  };

  const handleAddOption = (questionIndex) => {
    setQuestions((prev) => {
      const updatedQuestions = [...prev];
      updatedQuestions[questionIndex] = {
        ...updatedQuestions[questionIndex],
        options: [...updatedQuestions[questionIndex].options, { text: '', isCorrect: false }],
      };
      return updatedQuestions;
    });
    setQuestionsError(null);
  };

  const handleRemoveQuestion = (questionIndex) => {
    setQuestions((prev) => prev.filter((_, i) => i !== questionIndex));
    setQuestionsError(null);
  };

  const openDeleteDialog = () => setDeleteDialogOpen(true);
  const closeDeleteDialog = () => setDeleteDialogOpen(false);

  const confirmDeleteQuiz = async () => {
    if (!quizId) return;
    setIsDeletingQuiz(true);
    setDeleteError(null);
    try {
      await quizApi.deleteQuiz(quizId);
      closeDeleteDialog();
      navigate(`/knowledge_path/${currentPathId}/edit`);
    } catch (err) {
      setDeleteError(err?.message || err?.response?.data?.error || 'Error al eliminar el cuestionario');
    } finally {
      setIsDeletingQuiz(false);
    }
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

        {loadError && (
          <Alert severity="error">{loadError}</Alert>
        )}

        {submitError && (
          <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>
            {submitError}
          </Alert>
        )}

        {questionsError && (
          <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>
            {questionsError}
          </Alert>
        )}

        {deleteError && (
          <Alert severity="error">{deleteError}</Alert>
        )}

        <Paper elevation={1} sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={4}>
              <FormControl fullWidth required error={!!errors.precedingNodeId}>
                <InputLabel id="preceding-node-label">Seleccionar Nodo Precedente</InputLabel>
                <Controller
                  name="precedingNodeId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      labelId="preceding-node-label"
                      id="preceding-node"
                      label="Seleccionar Nodo Precedente"
                    >
                      <MenuItem value="">
                        <em>Seleccionar un nodo...</em>
                      </MenuItem>
                      {nodes.map((node) => (
                        <MenuItem key={node.id} value={String(node.id)}>
                          {node.title}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
                {errors.precedingNodeId && (
                  <FormHelperText>{errors.precedingNodeId.message}</FormHelperText>
                )}
              </FormControl>

              <TextField
                fullWidth
                required
                label="Título del Cuestionario"
                variant="outlined"
                error={!!errors.title}
                helperText={errors.title?.message}
                {...register('title')}
              />

              <TextField
                fullWidth
                label="Descripción del Cuestionario"
                variant="outlined"
                multiline
                rows={3}
                error={!!errors.description}
                helperText={errors.description?.message}
                {...register('description')}
              />

              <Divider />

              <Box>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                  <QuizIcon color="primary" />
                  <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                    Preguntas
                  </Typography>
                  {questions.length > 0 && (
                    <Chip label={`${questions.length} pregunta(s)`} size="small" color="primary" variant="outlined" />
                  )}
                </Stack>

                <Stack spacing={3}>
                  {questions.map((question, qIndex) => (
                    <Card key={qIndex} variant="outlined" sx={{ borderRadius: 2 }}>
                      <CardContent>
                        <Stack spacing={3}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              Pregunta {qIndex + 1}
                            </Typography>
                            {questions.length > 1 && (
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

              <FormControl fullWidth required error={!!errors.max_attempts_per_day}>
                <InputLabel id="max-attempts-label">Intentos Máximos por Día</InputLabel>
                <Controller
                  name="max_attempts_per_day"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      labelId="max-attempts-label"
                      id="max-attempts"
                      label="Intentos Máximos por Día"
                      onChange={(e) => {
                        const value = Math.max(2, parseInt(e.target.value, 10) || 2);
                        field.onChange(value);
                      }}
                    >
                      {[2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <MenuItem key={num} value={num}>
                          {num} intentos
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
                <FormHelperText error={!!errors.max_attempts_per_day}>
                  {errors.max_attempts_per_day?.message ||
                    'Establezca cuántas veces un estudiante puede intentar este cuestionario por día'}
                </FormHelperText>
              </FormControl>

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
                  disabled={isSubmitting}
                  sx={{ textTransform: 'none' }}
                >
                  {isSubmitting ? (
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

        {mode === 'edit' && (
          <Paper
            elevation={1}
            sx={{
              mt: 2,
              p: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'error.light',
            }}
          >
            <Typography variant="h6" color="error" sx={{ fontWeight: 700, mb: 1 }}>
              Zona de peligro
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Si eliminas este cuestionario se borrarán todas sus preguntas y respuestas y no podrás recuperarlos.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteForeverIcon />}
              onClick={openDeleteDialog}
              sx={{ textTransform: 'none' }}
            >
              Eliminar cuestionario
            </Button>
          </Paper>
        )}
      </Stack>

      <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar cuestionario</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            ¿Seguro que deseas eliminar <strong>{title || 'este cuestionario'}</strong>? Se eliminarán todas las preguntas y esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} disabled={isDeletingQuiz} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button onClick={confirmDeleteQuiz} disabled={isDeletingQuiz} color="error" variant="contained" sx={{ textTransform: 'none' }}>
            {isDeletingQuiz ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default QuizForm;
