import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Checkbox,
    Chip,
    Link as MuiLink,
    Divider,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    IconButton,
    TablePagination,
    CircularProgress,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import contentApi from '../api/contentApi';
import { formatDate } from '../utils/dateUtils';

const DEFAULT_PAGE_SIZE = 25;

const LibrarySelectMultiple = ({
    onCancel,
    onSave,
    onSelectionChange,
    title = "Seleccionar contenido de la biblioteca",
    description,
    filterFunction,
    excludeTopicId = null,
    excludeCollectionId = null,
    maxSelections,
    selectedIds = [],
    contextName = "",
    compact = false
}) => {
    const [userContent, setUserContent] = useState([]);
    const [selectedContentProfiles, setSelectedContentProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchDebounced, setSearchDebounced] = useState('');
    const [selectedCollectionId, setSelectedCollectionId] = useState(null);
    const [sortField, setSortField] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc');
    const [collections, setCollections] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        const t = setTimeout(() => {
            setSearchDebounced(searchQuery.trim());
        }, 400);
        return () => clearTimeout(t);
    }, [searchQuery]);

    useEffect(() => {
        setPage(0);
    }, [searchDebounced, selectedCollectionId, sortField, sortDirection, excludeTopicId, excludeCollectionId]);

    useEffect(() => {
        const fetchCollections = async () => {
            try {
                const data = await contentApi.getUserCollections();
                setCollections(data || []);
            } catch (err) {
                console.error('LibrarySelectMultiple: Error fetching collections:', err);
            }
        };
        fetchCollections();
    }, []);

    // Seed selection from selectedIds once (IDs only until profiles are loaded from pages)
    useEffect(() => {
        if (!selectedIds?.length) return;
        setSelectedContentProfiles((prev) => {
            if (prev.length > 0) return prev;
            return selectedIds.map((id) => ({ id }));
        });
    }, [selectedIds]);

    const ordering = (() => {
        if (!sortField) return '-created_at';
        return sortDirection === 'desc' ? `-${sortField}` : sortField;
    })();

    const loadLibraryPage = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await contentApi.getUserContentWithDetails({
                page: page + 1,
                page_size: rowsPerPage,
                search: searchDebounced,
                collection: selectedCollectionId || undefined,
                exclude_topic: excludeTopicId || undefined,
                exclude_collection: excludeCollectionId || undefined,
                ordering,
            });
            let results = Array.isArray(data?.results) ? data.results : [];
            if (filterFunction) {
                results = results.filter(filterFunction);
            }
            setUserContent(results);
            setTotalCount(typeof data?.count === 'number' ? data.count : 0);

            // Enrich stub selections with full profile data when they appear on a page
            setSelectedContentProfiles((prev) => {
                if (prev.length === 0) return prev;
                const byId = new Map(results.map((item) => [item.id, item]));
                let changed = false;
                const next = prev.map((item) => {
                    const full = byId.get(item.id);
                    if (full && (!item.title || !item.content)) {
                        changed = true;
                        return full;
                    }
                    return item;
                });
                return changed ? next : prev;
            });
        } catch (err) {
            console.error('LibrarySelectMultiple: Error fetching content:', err);
            setError('Error al obtener tu contenido');
            setUserContent([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [
        page,
        rowsPerPage,
        searchDebounced,
        selectedCollectionId,
        excludeTopicId,
        excludeCollectionId,
        ordering,
        filterFunction,
    ]);

    useEffect(() => {
        loadLibraryPage();
    }, [loadLibraryPage]);

    const handleContentToggle = (contentProfile) => {
        setSelectedContentProfiles((prev) => {
            let newSelection;
            if (prev.some((p) => p.id === contentProfile.id)) {
                newSelection = prev.filter((p) => p.id !== contentProfile.id);
            } else if (maxSelections === 1) {
                newSelection = [contentProfile];
            } else if (!maxSelections || prev.length < maxSelections) {
                newSelection = [...prev, contentProfile];
            } else {
                return prev;
            }

            if (onSelectionChange) {
                onSelectionChange(newSelection);
            }

            return newSelection;
        });
    };

    const handleSelectAll = (event) => {
        let newSelection;
        if (event.target.checked) {
            const selectedNotInPage = selectedContentProfiles.filter(
                (selected) => !userContent.some((item) => item.id === selected.id)
            );
            const itemsToAdd = maxSelections
                ? userContent.slice(0, Math.max(0, maxSelections - selectedNotInPage.length))
                : userContent;
            newSelection = [...selectedNotInPage, ...itemsToAdd];
        } else {
            newSelection = selectedContentProfiles.filter(
                (selected) => !userContent.some((item) => item.id === selected.id)
            );
        }

        setSelectedContentProfiles(newSelection);
        if (onSelectionChange) {
            onSelectionChange(newSelection);
        }
    };

    const handleSortDirectionToggle = () => {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    };

    const handleChangePage = (_event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleSubmit = async () => {
        const ids = selectedContentProfiles.map((p) => p.id);
        setSaving(true);
        try {
            await onSave(ids);
        } catch (err) {
            console.error('LibrarySelectMultiple.handleSubmit - Error:', err);
            setError('Error al guardar las selecciones');
            setSaving(false);
        }
    };

    if (error && userContent.length === 0 && !loading) {
        return (
            <Box sx={{ pt: compact ? 0 : 12, px: compact ? 0 : 3 }}>
                <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
                <Button variant="contained" onClick={loadLibraryPage}>Reintentar</Button>
            </Box>
        );
    }

    return (
        <Box sx={{ pt: compact ? 0 : 12, px: compact ? 0 : 3, maxWidth: compact ? '100%' : 1200, mx: compact ? 0 : 'auto' }}>
            <Paper sx={{ p: compact ? 2 : 3 }}>
                <Box sx={{ mb: compact ? 1 : 3 }}>
                    <Typography variant={compact ? "h6" : "h4"} sx={{ mb: 1 }}>
                        {title} {contextName && `: ${contextName}`}
                    </Typography>
                    {description && (
                        <Typography variant="body1" color="text.secondary">
                            {description}
                        </Typography>
                    )}
                    {maxSelections && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Se pueden seleccionar máximo {maxSelections} elementos
                        </Typography>
                    )}
                </Box>

                <Divider sx={{ my: compact ? 1.5 : 3 }} />

                <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                    <TextField
                        placeholder="Buscar contenido..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        size="small"
                        InputProps={{
                            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        }}
                        sx={{ flexGrow: 1, minWidth: 200 }}
                    />

                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Colección</InputLabel>
                        <Select
                            value={selectedCollectionId || ''}
                            label="Colección"
                            onChange={(e) => setSelectedCollectionId(e.target.value || null)}
                        >
                            <MenuItem value="">
                                <em>Todas las colecciones</em>
                            </MenuItem>
                            {collections.map((collection) => (
                                <MenuItem key={collection.id} value={collection.id}>
                                    {collection.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Ordenar por</InputLabel>
                        <Select
                            value={sortField || ''}
                            label="Ordenar por"
                            onChange={(e) => setSortField(e.target.value || null)}
                        >
                            <MenuItem value="">
                                <em>Sin ordenar</em>
                            </MenuItem>
                            <MenuItem value="title">Título</MenuItem>
                            <MenuItem value="author">Autor</MenuItem>
                            <MenuItem value="created_at">Fecha de subida</MenuItem>
                        </Select>
                    </FormControl>

                    {sortField && (
                        <IconButton
                            onClick={handleSortDirectionToggle}
                            size="small"
                            sx={{ border: 1, borderColor: 'divider' }}
                            title={sortDirection === 'asc' ? 'Ascendente' : 'Descendente'}
                        >
                            {sortDirection === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
                        </IconButton>
                    )}
                </Box>

                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Typography variant="h6">
                        Contenido disponible ({totalCount})
                        {loading && (
                            <CircularProgress size={16} sx={{ ml: 1, verticalAlign: 'middle' }} />
                        )}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            onClick={onCancel}
                            disabled={saving}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSubmit}
                            disabled={selectedContentProfiles.length === 0 || saving}
                        >
                            {saving ? 'Guardando...' : `Elegir (${selectedContentProfiles.length})`}
                        </Button>
                    </Box>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
                )}

                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        indeterminate={
                                            userContent.length > 0 &&
                                            userContent.some((item) => selectedContentProfiles.some((p) => p.id === item.id)) &&
                                            !userContent.every((item) => selectedContentProfiles.some((p) => p.id === item.id))
                                        }
                                        checked={
                                            userContent.length > 0 &&
                                            userContent.every((item) => selectedContentProfiles.some((p) => p.id === item.id))
                                        }
                                        onChange={handleSelectAll}
                                        disabled={maxSelections && selectedContentProfiles.length >= maxSelections}
                                    />
                                </TableCell>
                                <TableCell>Título</TableCell>
                                <TableCell>Tipo</TableCell>
                                <TableCell>Autor</TableCell>
                                <TableCell>Fecha de subida</TableCell>
                                <TableCell>Ver</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading && userContent.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center">
                                        Cargando tu contenido...
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <>
                                    {userContent.map((content) => (
                                        <TableRow
                                            key={content.id}
                                            hover
                                            onClick={() => handleContentToggle(content)}
                                            sx={{ cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
                                        >
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={selectedContentProfiles.some((p) => p.id === content.id)}
                                                    disabled={maxSelections && selectedContentProfiles.length >= maxSelections && !selectedContentProfiles.some((p) => p.id === content.id)}
                                                />
                                            </TableCell>
                                            <TableCell>{content.title || 'Sin título'}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={content.content?.media_type || '-'}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>{content.author || 'Desconocido'}</TableCell>
                                            <TableCell>
                                                {content.created_at ? formatDate(content.created_at) : '—'}
                                            </TableCell>
                                            <TableCell
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <MuiLink
                                                    href={`/content/${content.content?.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 0.5,
                                                        color: 'primary.main',
                                                        textDecoration: 'none',
                                                        '&:hover': {
                                                            textDecoration: 'underline'
                                                        }
                                                    }}
                                                >
                                                    Ver
                                                    <OpenInNewIcon fontSize="small" />
                                                </MuiLink>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {userContent.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center">
                                                {searchDebounced || selectedCollectionId !== null
                                                    ? 'No se encontró contenido con los filtros aplicados'
                                                    : 'No hay contenido disponible'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <TablePagination
                    component="div"
                    count={totalCount}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[12, 25, 50, 100]}
                    labelRowsPerPage="Por página"
                    labelDisplayedRows={({ from, to, count }) =>
                        `${from}–${to} de ${count !== -1 ? count : `más de ${to}`}`
                    }
                />
            </Paper>
        </Box>
    );
};

export default LibrarySelectMultiple;
