import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  Link,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import contentApi from '../api/contentApi';
import { getMediaType } from './mediaTypeFromFile';
import { inferTitleAuthorFromFileName, resolveAuthorWithFolderHint } from './inferTitleAuthorFromFileName';

const FOLDER_BATCH_MAX_BYTES = 10 * 1024 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 3;

const MEDIA_TYPE_LABELS = { IMAGE: 'Imagen', VIDEO: 'Video', AUDIO: 'Audio', TEXT: 'Texto' };

function formatBytes(n) {
  if (n === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${parseFloat((n / k ** i).toFixed(i > 1 ? 2 : 0))} ${sizes[i]}`;
}

function newRowId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function buildRowsFromFileList(files, defaultAuthorFromUser) {
  const omitted = [];
  const rows = [];
  for (const file of files) {
    const relativePath = file.webkitRelativePath || file.name;
    const mediaType = getMediaType(file);
    if (!mediaType) {
      omitted.push({ path: relativePath, reason: 'Tipo de archivo no soportado' });
      continue;
    }
    const inferred = inferTitleAuthorFromFileName(file.name);
    const { author, title } = resolveAuthorWithFolderHint(relativePath, inferred, defaultAuthorFromUser);
    rows.push({
      id: newRowId(),
      file,
      relativePath,
      title,
      author,
      mediaType,
      status: 'pending',
      error: null,
    });
  }
  return { rows, omitted };
}

async function runPool(items, limit, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, async () => {
    while (index < items.length) {
      const i = index;
      index += 1;
      const item = items[i];
      await worker(item, i);
    }
  });
  await Promise.all(runners);
}

const LibraryFolderUpload = () => {
  const navigate = useNavigate();
  const folderInputRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [omitted, setOmitted] = useState([]);
  const [defaultFolderAuthor, setDefaultFolderAuthor] = useState('');
  const [hasSpanishSubtitles, setHasSpanishSubtitles] = useState(false);
  const [hasSpanishDubbing, setHasSpanishDubbing] = useState(false);
  const [isProducer, setIsProducer] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [globalProgress, setGlobalProgress] = useState({ loaded: 0, total: 0 });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await contentApi.getUserCollections();
        if (!cancelled) setCollections(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setCollections([]);
      } finally {
        if (!cancelled) setCollectionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalBytes = useMemo(() => rows.reduce((s, r) => s + (r.file?.size || 0), 0), [rows]);
  const overLimit = totalBytes > FOLDER_BATCH_MAX_BYTES;
  const pendingCount = useMemo(() => rows.filter((r) => r.status === 'pending').length, [rows]);

  const handleFolderChange = useCallback(
    (event) => {
      const files = Array.from(event.target.files || []);
      event.target.value = '';
      if (files.length === 0) {
        setRows([]);
        setOmitted([]);
        return;
      }
      const { rows: nextRows, omitted: nextOmitted } = buildRowsFromFileList(files, defaultFolderAuthor);
      setRows(nextRows);
      setOmitted(nextOmitted);
    },
    [defaultFolderAuthor]
  );

  const updateRow = useCallback((id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const handleStartUploads = async () => {
    if (rows.length === 0 || overLimit || isUploading) return;
    const toUpload = rows.filter((r) => r.status === 'pending');
    if (toUpload.length === 0) return;

    const totalSize = toUpload.reduce((s, r) => s + r.file.size, 0);
    setGlobalProgress({ loaded: 0, total: totalSize });
    setIsUploading(true);

    const progressById = Object.fromEntries(toUpload.map((r) => [r.id, 0]));
    const bumpGlobal = () => {
      const loaded = Object.values(progressById).reduce((a, b) => a + b, 0);
      setGlobalProgress({ loaded: Math.min(loaded, totalSize), total: totalSize });
    };

    let success = 0;
    let failed = 0;
    const successfulContentProfileIds = [];

    await runPool(toUpload, UPLOAD_CONCURRENCY, async (row) => {
      updateRow(row.id, { status: 'uploading', error: null });
      try {
        const result = await contentApi.uploadContentViaS3(
          row.file,
          {
            media_type: row.mediaType,
            title: row.title || '',
            author: row.author || '',
            personalNote: '',
            is_visible: isVisible,
            is_producer: isProducer,
            has_spanish_subtitles: hasSpanishSubtitles,
            has_spanish_dubbing: hasSpanishDubbing,
          },
          (e) => {
            if (e.total) {
              progressById[row.id] = e.loaded;
              bumpGlobal();
            }
          }
        );
        progressById[row.id] = row.file.size;
        bumpGlobal();
        updateRow(row.id, { status: 'done', error: null });
        success += 1;
        const profileId = result?.content_profile?.id;
        if (profileId != null) successfulContentProfileIds.push(profileId);
      } catch (error) {
        const backendError = error.response?.data?.error;
        const backendDetails = error.response?.data?.details;
        const message = backendError
          ? backendDetails
            ? `${backendError}: ${backendDetails}`
            : backendError
          : error.message || 'Error al subir';
        progressById[row.id] = 0;
        bumpGlobal();
        updateRow(row.id, { status: 'error', error: message });
        failed += 1;
      }
    });

    let collectionMessage = '';
    if (selectedCollectionId && successfulContentProfileIds.length > 0) {
      try {
        await contentApi.addContentToCollection(Number(selectedCollectionId), successfulContentProfileIds);
        collectionMessage = ' Contenido añadido a la colección elegida.';
      } catch (err) {
        const ce = err.response?.data?.error;
        const cd = err.response?.data?.details;
        const cmsg = ce ? (cd ? `${ce}: ${cd}` : ce) : err.message || 'Error desconocido';
        collectionMessage = ` No se pudo añadir a la colección: ${cmsg}`;
      }
    }

    setIsUploading(false);

    const baseSeverity = failed ? 'warning' : collectionMessage.includes('No se pudo') ? 'warning' : 'success';
    const baseMessage =
      failed === 0
        ? `Subida completada: ${success} archivo(s).${collectionMessage}`
        : `Finalizado: ${success} correcto(s), ${failed} con error.${collectionMessage}`;

    setSnackbar({
      open: true,
      severity: baseSeverity,
      message: baseMessage.trim(),
    });

    if (success > 0) {
      window.setTimeout(() => {
        navigate('/content/library_user');
      }, 650);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/content/library_upload_content')} sx={{ textTransform: 'none' }}>
          Volver a subir contenido
        </Button>
      </Stack>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Subir carpeta
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Selecciona una carpeta; cada archivo compatible se sube como un ítem en tu biblioteca. Puedes elegir una colección y
          revisar título y autor antes de subir.
        </Typography>
      </Box>

      <Alert severity="warning" sx={{ mb: 3 }}>
        El tamaño total de los archivos de esta carpeta no puede superar {formatBytes(FOLDER_BATCH_MAX_BYTES)} por operación. Total
        actual: <strong>{formatBytes(totalBytes)}</strong>
        {overLimit ? ' (excede el límite)' : ''}.
      </Alert>

      <Paper elevation={2} sx={{ p: 3 }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                  Autor por defecto (opcional)
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Si el nombre del archivo no indica autor, se usará este valor antes que el nombre de la primera subcarpeta en la
                  ruta.
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="p. ej. nombre del curso o autor"
                  value={defaultFolderAuthor}
                  onChange={(e) => setDefaultFolderAuthor(e.target.value)}
                  disabled={isUploading}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Si lo cambias después de elegir la carpeta, vuelve a pulsar &quot;Seleccionar carpeta&quot; para regenerar títulos y
                  autores.
                </Typography>
              </Box>

              <Box>
                <input
                  ref={folderInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  multiple
                  {...{ webkitdirectory: '', directory: '' }}
                  onChange={handleFolderChange}
                />
                <Button
                  variant="outlined"
                  startIcon={<FolderOpenIcon />}
                  onClick={() => folderInputRef.current?.click()}
                  disabled={isUploading}
                  sx={{ textTransform: 'none' }}
                >
                  Seleccionar carpeta
                </Button>
                {rows.length > 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {rows.length} archivo(s) listo(s) para subir
                    {omitted.length > 0 ? ` · ${omitted.length} omitido(s)` : ''}
                  </Typography>
                )}
              </Box>

              <FormControl fullWidth size="small" disabled={isUploading || collectionsLoading}>
                <InputLabel id="folder-upload-collection-label">Colección (opcional)</InputLabel>
                <Select
                  labelId="folder-upload-collection-label"
                  label="Colección (opcional)"
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Solo mi biblioteca</em>
                  </MenuItem>
                  {collections.map((c) => (
                    <MenuItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {!collectionsLoading && collections.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  No tienes colecciones.{' '}
                  <Link component={RouterLink} to="/content/collections/create" underline="hover">
                    Crear una
                  </Link>
                </Typography>
              )}

              {omitted.length > 0 && (
                <Alert severity="info">
                  <Typography variant="subtitle2" gutterBottom>
                    Archivos omitidos
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2, maxHeight: 160, overflow: 'auto' }}>
                    {omitted.map((o) => (
                      <li key={o.path}>
                        <Typography variant="caption" component="span">
                          {o.path} — {o.reason}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                </Alert>
              )}

              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={hasSpanishSubtitles}
                      onChange={(e) => setHasSpanishSubtitles(e.target.checked)}
                      disabled={isUploading}
                    />
                  }
                  label="Tiene subtítulos en español (todos los archivos)"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={hasSpanishDubbing}
                      onChange={(e) => setHasSpanishDubbing(e.target.checked)}
                      disabled={isUploading}
                    />
                  }
                  label="Está doblado al español (todos los archivos)"
                />
                <FormControlLabel
                  control={<Checkbox checked={isProducer} onChange={(e) => setIsProducer(e.target.checked)} disabled={isUploading} />}
                  label="He producido este contenido"
                />
                {isProducer && (
                  <Box sx={{ ml: 3, mt: 1 }}>
                    <FormControlLabel
                      control={
                        <Switch checked={isVisible} onChange={(e) => setIsVisible(e.target.checked)} disabled={isUploading} />
                      }
                      label="Visible en los resultados de búsqueda"
                    />
                  </Box>
                )}
              </Box>

              {rows.length > 0 && (
                <>
                  <TableContainer sx={{ maxHeight: 420, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Ruta</TableCell>
                          <TableCell width={100}>Tipo</TableCell>
                          <TableCell>Título</TableCell>
                          <TableCell>Autor</TableCell>
                          <TableCell width={110}>Estado</TableCell>
                          <TableCell width={96}>Acción</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.id} hover selected={row.status === 'uploading'}>
                            <TableCell>
                              <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                                {row.relativePath}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip size="small" label={MEDIA_TYPE_LABELS[row.mediaType] ?? row.mediaType} variant="outlined" />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                fullWidth
                                value={row.title}
                                onChange={(e) => updateRow(row.id, { title: e.target.value })}
                                disabled={isUploading || row.status === 'done'}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                fullWidth
                                value={row.author}
                                onChange={(e) => updateRow(row.id, { author: e.target.value })}
                                disabled={isUploading || row.status === 'done'}
                              />
                            </TableCell>
                            <TableCell>
                              {row.status === 'pending' && (
                                <Typography variant="caption" color="text.secondary">
                                  Pendiente
                                </Typography>
                              )}
                              {row.status === 'uploading' && <CircularProgress size={18} />}
                              {row.status === 'done' && (
                                <Typography variant="caption" color="success.main">
                                  Listo
                                </Typography>
                              )}
                              {row.status === 'error' && (
                                <Typography variant="caption" color="error" title={row.error || ''}>
                                  Error
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {row.status === 'error' && !isUploading && (
                                <Button
                                  size="small"
                                  sx={{ textTransform: 'none' }}
                                  onClick={() => updateRow(row.id, { status: 'pending', error: null })}
                                >
                                  Reintentar
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {rows.some((r) => r.status === 'error' && r.error) && (
                    <Alert severity="error">
                      {rows
                        .filter((r) => r.status === 'error' && r.error)
                        .map((r) => (
                          <Typography key={r.id} variant="caption" display="block">
                            {r.relativePath}: {r.error}
                          </Typography>
                        ))}
                    </Alert>
                  )}

                  {isUploading && globalProgress.total > 0 && (
                    <Box>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.round((globalProgress.loaded / globalProgress.total) * 100)}
                          sx={{ flex: 1, height: 8, borderRadius: 1 }}
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                          {formatBytes(globalProgress.loaded)} / {formatBytes(globalProgress.total)}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Subiendo… no cierres esta pestaña.
                      </Typography>
                    </Box>
                  )}

                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                    <Button
                      variant="contained"
                      disabled={overLimit || pendingCount === 0 || isUploading}
                      onClick={handleStartUploads}
                      startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : null}
                    >
                      {isUploading ? 'Subiendo…' : pendingCount > 0 ? `Subir ${pendingCount} pendiente(s)` : 'Todo subido'}
                    </Button>
                    {pendingCount < rows.length && !isUploading && (
                      <Typography variant="caption" color="text.secondary">
                        Puedes volver a subir solo los pendientes o corregir errores y pulsar de nuevo.
                      </Typography>
                    )}
                  </Stack>
                </>
              )}
            </Stack>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={8000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar((s) => ({ ...s, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default LibraryFolderUpload;
