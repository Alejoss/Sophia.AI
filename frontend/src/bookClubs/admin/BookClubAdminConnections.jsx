import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import bookClubsApi from '../../api/bookClubsApi';
import contentApi from '../../api/contentApi';
import knowledgePathsApi from '../../api/knowledgePathsApi';
import { extractApiError } from '../clubTheme';

const BookClubAdminConnections = () => {
  const { slug } = useParams();
  const { club, reload } = useOutletContext();
  const [paths, setPaths] = useState([]);
  const [topics, setTopics] = useState([]);
  const [knowledgePath, setKnowledgePath] = useState(club?.knowledge_path ? String(club.knowledge_path) : '');
  const [topic, setTopic] = useState(club?.topic != null ? String(club.topic) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    setKnowledgePath(club?.knowledge_path ? String(club.knowledge_path) : '');
    setTopic(club?.topic != null ? String(club.topic) : '');
  }, [club]);

  useEffect(() => {
    (async () => {
      const [topicsData, pathsData] = await Promise.all([
        contentApi.getTopics().catch(() => []),
        knowledgePathsApi.getUserKnowledgePaths(1, 100).catch(() => ({ results: [] })),
      ]);
      setTopics(Array.isArray(topicsData) ? topicsData : topicsData?.results || []);
      setPaths(Array.isArray(pathsData) ? pathsData : pathsData?.results || []);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        topic: topic === '' ? null : Number(topic),
      };
      if (knowledgePath !== '') {
        payload.knowledge_path = Number(knowledgePath);
      }
      await bookClubsApi.updateClub(slug, payload);
      setSuccess('Conexiones actualizadas.');
      await reload();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Conexiones
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
        El knowledge path alimenta las misiones. El topic es la comunidad abierta del ciclo. Si al
        crear el club no elegiste path, ya se generó uno vacío automáticamente.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Stack spacing={2} maxWidth={640}>
        <FormControl fullWidth>
          <InputLabel id="path-label">Knowledge path</InputLabel>
          <Select
            labelId="path-label"
            label="Knowledge path"
            value={knowledgePath}
            onChange={(e) => setKnowledgePath(e.target.value)}
          >
            <MenuItem value="">
              {club?.knowledge_path_title
                ? `Actual: ${club.knowledge_path_title}`
                : 'Sin cambiar'}
            </MenuItem>
            {paths.map((path) => (
              <MenuItem key={path.id} value={String(path.id)}>
                {path.title} (#{path.id})
              </MenuItem>
            ))}
            {club?.knowledge_path &&
              !paths.some((p) => String(p.id) === String(club.knowledge_path)) && (
                <MenuItem value={String(club.knowledge_path)}>
                  {club.knowledge_path_title || `Path #${club.knowledge_path}`}
                </MenuItem>
              )}
          </Select>
        </FormControl>

        {club?.knowledge_path && (
          <Button
            component={RouterLink}
            to={`/knowledge_path/${club.knowledge_path}/edit`}
            variant="outlined"
            sx={{ alignSelf: 'flex-start' }}
          >
            Editar misiones del path
          </Button>
        )}

        <FormControl fullWidth>
          <InputLabel id="topic-label">Topic (comunidad)</InputLabel>
          <Select
            labelId="topic-label"
            label="Topic (comunidad)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          >
            <MenuItem value="">Sin topic</MenuItem>
            {topics.map((t) => (
              <MenuItem key={t.id} value={String(t.id)}>
                {t.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {club?.topic && (
          <Button
            component={RouterLink}
            to={`/content/topics/${club.topic}`}
            variant="outlined"
            sx={{ alignSelf: 'flex-start' }}
          >
            Abrir topic
          </Button>
        )}

        <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ alignSelf: 'flex-start' }}>
          {saving ? 'Guardando…' : 'Guardar conexiones'}
        </Button>
      </Stack>
    </Box>
  );
};

export default BookClubAdminConnections;
