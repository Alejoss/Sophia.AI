import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Grid,
    TextField,
    Button,
    Typography,
    Paper,
    Alert,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
} from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import contentApi from '../api/contentApi';

const MAX_PENDING_TOPIC_REQUESTS = 3;

const STATUS_LABELS = {
    PENDING: 'Pendiente',
    APPROVED: 'Aprobada',
    REJECTED: 'Rechazada',
    COMPLETED: 'Tema creado',
    CANCELLED: 'Cancelada',
};

const STATUS_COLORS = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'error',
    COMPLETED: 'default',
    CANCELLED: 'default',
};

const TopicCreationForm = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        proposed_title: '',
        proposed_description: '',
    });
    const [requests, setRequests] = useState([]);
    const [loadingRequests, setLoadingRequests] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [creatingTopicId, setCreatingTopicId] = useState(null);
    const [cancellingId, setCancellingId] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const fetchRequests = useCallback(async () => {
        try {
            setLoadingRequests(true);
            const data = await contentApi.getTopicCreationRequests();
            setRequests(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error loading topic creation requests:', err);
        } finally {
            setLoadingRequests(false);
        }
    }, []);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const pendingCount = requests.filter((req) => req.status === 'PENDING').length;
    const atPendingLimit = pendingCount >= MAX_PENDING_TOPIC_REQUESTS;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setSuccess(null);
        try {
            await contentApi.createTopicCreationRequest(formData);
            setSuccess('Solicitud enviada. Un administrador revisará el título y la descripción.');
            setFormData({ proposed_title: '', proposed_description: '' });
            await fetchRequests();
        } catch (err) {
            const apiError = err.response?.data?.error
                || err.response?.data?.proposed_title?.[0]
                || 'Error al enviar la solicitud';
            setError(apiError);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateTopic = async (request) => {
        setCreatingTopicId(request.id);
        setError(null);
        try {
            const response = await contentApi.createTopic({
                creation_request_id: request.id,
            });
            const topicId = response?.id ?? response?.data?.id;
            if (topicId) {
                navigate(`/content/topics/${topicId}/edit`, { replace: true });
                return;
            }
            await fetchRequests();
            setSuccess('¡Tema creado exitosamente!');
        } catch (err) {
            setError(err.response?.data?.error || 'Error al crear el tema');
        } finally {
            setCreatingTopicId(null);
        }
    };

    const handleCancelRequest = async (request) => {
        setCancellingId(request.id);
        setError(null);
        try {
            await contentApi.cancelTopicCreationRequest(request.id);
            setSuccess('Solicitud cancelada.');
            await fetchRequests();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al cancelar la solicitud');
        } finally {
            setCancellingId(null);
        }
    };

    return (
        <Box
            sx={{
                pt: { xs: 2, md: 4 },
                px: { xs: 1, md: 3 },
                maxWidth: 1000,
                mx: 'auto',
                color: 'text.primary',
            }}
        >
            <Grid container spacing={3}>
                <Grid item xs={12} md={7}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography
                            variant="h4"
                            gutterBottom
                            color="text.primary"
                            sx={{
                                fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
                                fontWeight: 400,
                                fontSize: { xs: '20px', sm: '24px', md: '24px' },
                            }}
                        >
                            Solicitar creación de tema
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Antes de crear un tema, envía una solicitud con el título y la descripción propuestos.
                            Un administrador la revisará para asegurar que el tema sea lo bastante específico.
                        </Typography>

                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {error}
                            </Alert>
                        )}

                        {success && (
                            <Alert severity="success" sx={{ mb: 2 }}>
                                {success}
                            </Alert>
                        )}

                        {atPendingLimit ? (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Ya tienes {MAX_PENDING_TOPIC_REQUESTS} solicitudes pendientes de revisión.
                                Podrás enviar otra cuando alguna sea resuelta.
                            </Alert>
                        ) : (
                            <form onSubmit={handleSubmitRequest}>
                                <TextField
                                    fullWidth
                                    label="Título propuesto"
                                    placeholder="Elige un tema no muy amplio"
                                    name="proposed_title"
                                    value={formData.proposed_title}
                                    onChange={handleChange}
                                    helperText="Un buen tema trata sobre algo de algo."
                                    required
                                    sx={{ mb: 2 }}
                                />

                                <TextField
                                    fullWidth
                                    label="Descripción propuesta"
                                    name="proposed_description"
                                    value={formData.proposed_description}
                                    onChange={handleChange}
                                    multiline
                                    rows={4}
                                    sx={{ mb: 3 }}
                                />

                                <Button
                                    type="submit"
                                    variant="contained"
                                    color="primary"
                                    fullWidth
                                    disabled={submitting}
                                >
                                    {submitting ? 'Enviando...' : 'Enviar solicitud'}
                                </Button>
                            </form>
                        )}

                        <Box sx={{ mt: 4 }}>
                            <Typography variant="h6" gutterBottom>
                                Mis solicitudes
                            </Typography>
                            {loadingRequests ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                    <CircularProgress size={28} />
                                </Box>
                            ) : requests.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                    Aún no has enviado solicitudes.
                                </Typography>
                            ) : (
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Título</TableCell>
                                                <TableCell>Estado</TableCell>
                                                <TableCell align="right">Acción</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {requests.map((request) => (
                                                <TableRow key={request.id}>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={500}>
                                                            {request.status === 'APPROVED' || request.status === 'COMPLETED'
                                                                ? request.approved_title
                                                                : request.proposed_title}
                                                        </Typography>
                                                        {request.status === 'REJECTED' && request.rejection_reason && (
                                                            <Typography variant="caption" color="error">
                                                                {request.rejection_reason}
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={STATUS_LABELS[request.status] || request.status}
                                                            color={STATUS_COLORS[request.status] || 'default'}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {request.status === 'PENDING' && (
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                color="error"
                                                                onClick={() => handleCancelRequest(request)}
                                                                disabled={cancellingId === request.id}
                                                            >
                                                                {cancellingId === request.id ? 'Cancelando...' : 'Cancelar'}
                                                            </Button>
                                                        )}
                                                        {request.status === 'APPROVED' && (
                                                            <Button
                                                                size="small"
                                                                variant="contained"
                                                                onClick={() => handleCreateTopic(request)}
                                                                disabled={creatingTopicId === request.id}
                                                            >
                                                                {creatingTopicId === request.id ? 'Creando...' : 'Crear tema'}
                                                            </Button>
                                                        )}
                                                        {request.status === 'COMPLETED' && request.topic_id && (
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                onClick={() => navigate(`/content/topics/${request.topic_id}`)}
                                                            >
                                                                Ver tema
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Box>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={5}>
                    <Paper
                        sx={{
                            p: 3,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.5,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Box
                                sx={{
                                    mr: 1.5,
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    bgcolor: 'primary.light',
                                    color: 'primary.contrastText',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <LightbulbIcon fontSize="small" />
                            </Box>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                ¿Cómo crear un buen tema?
                            </Typography>
                        </Box>

                        <Typography variant="body2" color="text.secondary">
                            Crear un Tema es un ejercicio de curaduría: eliges y organizas el mejor contenido que has encontrado sobre algo que te importa.
                        </Typography>

                        <Box sx={{ mt: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Piensa en esto cuando definas el título:
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Se restringe a un aspecto concreto, no a “todo sobre X”.
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Incluye contexto (lugar, tiempo o enfoque).
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Permite conectar contenido específico que realmente quieras guardar y compartir.
                            </Typography>
                        </Box>

                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Evita títulos demasiado amplios como:
                            </Typography>
                            <Typography variant="body2" color="text.secondary">• Terrorismo</Typography>
                            <Typography variant="body2" color="text.secondary">• Medicina</Typography>
                            <Typography variant="body2" color="text.secondary">• Política</Typography>
                        </Box>

                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Mejores ejemplos de temas:
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Beneficios del consumo de miel para la salud
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • La verdad sobre el ataque terrorista de Oklahoma
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Radicalización online en los jóvenes
                            </Typography>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default TopicCreationForm;
