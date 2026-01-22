import React, { useState, useEffect, useMemo } from 'react';
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
    IconButton
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import contentApi from '../api/contentApi';

const LibrarySelectMultiple = ({ 
    onCancel, 
    onSave, 
    onSelectionChange,
    title = "Seleccionar contenido de la biblioteca",
    description,
    filterFunction,
    maxSelections,
    selectedIds = [],
    contextName = ""
}) => {
    console.log('LibrarySelectMultiple rendering with props:', {
        title,
        hasFilterFunction: !!filterFunction,
        maxSelections,
        selectedIdsCount: selectedIds.length,
        contextName
    });
    
    const [userContent, setUserContent] = useState([]);
    const [selectedContentProfiles, setSelectedContentProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    
    // New states for search, collection, and sorting
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCollectionId, setSelectedCollectionId] = useState(null);
    const [sortField, setSortField] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc');
    const [collections, setCollections] = useState([]);

    useEffect(() => {
        console.log('LibrarySelectMultiple useEffect triggered');
        
        const fetchUserContent = async () => {
            console.log('LibrarySelectMultiple: Fetching user content');
            try {
                const data = await contentApi.getUserContent();
                console.log('LibrarySelectMultiple: User content fetched:', {
                    totalItems: data.length,
                    sampleItem: data.length > 0 ? {
                        id: data[0].id,
                        title: data[0].title,
                        content: data[0].content
                    } : null
                });
                
                // Apply filter if provided
                if (filterFunction) {
                    console.log('LibrarySelectMultiple: Applying filter function');
                    const filteredData = data.filter(item => {
                        const result = filterFunction(item);
                        console.log('Filter result for item:', {
                            id: item.id,
                            title: item.title,
                            result
                        });
                        return result;
                    });
                    console.log('LibrarySelectMultiple: After filtering:', {
                        totalItems: data.length,
                        filteredItems: filteredData.length
                    });
                    setUserContent(filteredData);
                } else {
                    console.log('LibrarySelectMultiple: No filter function provided, using all items');
                    setUserContent(data);
                }
                setLoading(false);
            } catch (err) {
                console.error('LibrarySelectMultiple: Error fetching content:', err);
                setError('Error al obtener tu contenido');
                setLoading(false);
            }
        };

        fetchUserContent();
        
        return () => {
            console.log('LibrarySelectMultiple useEffect cleanup');
        };
    }, [filterFunction]);

    // Fetch user collections
    useEffect(() => {
        const fetchCollections = async () => {
            try {
                const data = await contentApi.getUserCollections();
                setCollections(data || []);
            } catch (err) {
                console.error('LibrarySelectMultiple: Error fetching collections:', err);
                // Don't set error state, just log it - collections are optional
            }
        };

        fetchCollections();
    }, []);

    // Initialize selectedContentProfiles from selectedIds prop
    useEffect(() => {
        if (selectedIds && selectedIds.length > 0 && userContent.length > 0) {
            const initialSelected = userContent.filter(item => 
                selectedIds.includes(item.id)
            );
            if (initialSelected.length > 0) {
                setSelectedContentProfiles(initialSelected);
            }
        }
    }, [selectedIds, userContent]);

    // Filtered and sorted content using useMemo for optimization
    const filteredContent = useMemo(() => {
        let filtered = [...userContent];

        // Apply collection filter
        if (selectedCollectionId !== null) {
            const collectionIdNum = typeof selectedCollectionId === 'string' 
                ? parseInt(selectedCollectionId) 
                : selectedCollectionId;
            
            filtered = filtered.filter(item => {
                // Check if content is in the selected collection
                // Content has a collection field that is the collection ID
                return item.collection === collectionIdNum || 
                       item.collection === selectedCollectionId;
            });
        }

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(item => {
                const title = (item.title || '').toLowerCase();
                const author = (item.author || '').toLowerCase();
                const mediaType = (item.content?.media_type || '').toLowerCase();
                
                return title.includes(query) || 
                       author.includes(query) || 
                       mediaType.includes(query);
            });
        }

        // Apply sorting
        if (sortField) {
            filtered = [...filtered].sort((a, b) => {
                let aValue, bValue;
                
                if (sortField === 'title') {
                    aValue = (a.title || 'Sin título').toLowerCase();
                    bValue = (b.title || 'Sin título').toLowerCase();
                } else if (sortField === 'author') {
                    aValue = (a.author || 'Desconocido').toLowerCase();
                    bValue = (b.author || 'Desconocido').toLowerCase();
                } else {
                    return 0;
                }

                if (aValue < bValue) {
                    return sortDirection === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortDirection === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return filtered;
    }, [userContent, selectedCollectionId, searchQuery, sortField, sortDirection]);

    const handleContentToggle = (contentProfile) => {
        console.log('LibrarySelectMultiple.handleContentToggle:', {
            contentProfileId: contentProfile.id,
            contentId: contentProfile.content.id,
            currentlySelected: selectedContentProfiles.map(p => p.id),
            willBeSelected: !selectedContentProfiles.some(p => p.id === contentProfile.id)
        });
        
        setSelectedContentProfiles(prev => {
            let newSelection;
            if (prev.some(p => p.id === contentProfile.id)) {
                newSelection = prev.filter(p => p.id !== contentProfile.id);
                console.log('Removing from selection:', {
                    contentProfileId: contentProfile.id,
                    newSelection: newSelection.map(p => p.id)
                });
            } else if (!maxSelections || prev.length < maxSelections) {
                newSelection = [...prev, contentProfile];
                console.log('Adding to selection:', {
                    contentProfileId: contentProfile.id,
                    newSelection: newSelection.map(p => p.id)
                });
            } else {
                return prev;
            }
            
            // Notify parent of selection change
            if (onSelectionChange) {
                onSelectionChange(newSelection);
            }
            
            return newSelection;
        });
    };

    const handleSelectAll = (event) => {
        console.log('LibrarySelectMultiple.handleSelectAll:', {
            checked: event.target.checked,
            maxSelections,
            totalItems: filteredContent.length
        });
        
        let newSelection;
        if (event.target.checked) {
            // Get currently selected items that are NOT in filteredContent
            const selectedNotInFiltered = selectedContentProfiles.filter(
                selected => !filteredContent.some(filtered => filtered.id === selected.id)
            );
            
            // Add all filtered items (up to maxSelections if applicable)
            const itemsToAdd = maxSelections 
                ? filteredContent.slice(0, maxSelections - selectedNotInFiltered.length)
                : filteredContent;
            
            newSelection = [...selectedNotInFiltered, ...itemsToAdd];
            console.log('Selecting all:', {
                selectedIds: newSelection.map(p => p.id),
                limited: maxSelections ? 'yes' : 'no'
            });
        } else {
            // Only deselect items that are in filteredContent
            newSelection = selectedContentProfiles.filter(
                selected => !filteredContent.some(filtered => filtered.id === selected.id)
            );
            console.log('Clearing filtered selections');
        }
        
        setSelectedContentProfiles(newSelection);
        
        // Notify parent of selection change
        if (onSelectionChange) {
            onSelectionChange(newSelection);
        }
    };

    const handleSortDirectionToggle = () => {
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    };

    const handleSubmit = async () => {
        const selectedIds = selectedContentProfiles.map(p => p.id);
        console.log('LibrarySelectMultiple.handleSubmit - Starting submission with:', {
            selectedIds,
            count: selectedIds.length
        });
        
        setSaving(true);
        try {
            console.log('LibrarySelectMultiple.handleSubmit - Calling onSave with selected IDs');
            await onSave(selectedIds);
            console.log('LibrarySelectMultiple.handleSubmit - Save successful');
        } catch (err) {
            console.error('LibrarySelectMultiple.handleSubmit - Error:', err);
            setError('Error al guardar las selecciones');
            setSaving(false);
        }
    };

    if (loading) return <Typography>Cargando tu contenido...</Typography>;
    if (error) return <Alert severity="error">{error}</Alert>;

    return (
        <Box sx={{ pt: 12, px: 3, maxWidth: 1200, mx: 'auto' }}>
            <Paper sx={{ p: 3 }}>
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h4" sx={{ mb: 1 }}>
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

                <Divider sx={{ my: 3 }} />

                {/* Toolbar with search, collection selector, and sorting */}
                <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                    {/* Search field */}
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

                    {/* Collection selector */}
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

                    {/* Sort field selector */}
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
                        </Select>
                    </FormControl>

                    {/* Sort direction toggle */}
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

                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">
                        Contenido disponible ({filteredContent.length})
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

                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        indeterminate={
                                            filteredContent.length > 0 && 
                                            filteredContent.some(item => selectedContentProfiles.some(p => p.id === item.id)) &&
                                            !filteredContent.every(item => selectedContentProfiles.some(p => p.id === item.id))
                                        }
                                        checked={
                                            filteredContent.length > 0 && 
                                            filteredContent.every(item => selectedContentProfiles.some(p => p.id === item.id))
                                        }
                                        onChange={handleSelectAll}
                                        disabled={maxSelections && selectedContentProfiles.length >= maxSelections}
                                    />
                                </TableCell>
                                <TableCell>Título</TableCell>
                                <TableCell>Tipo</TableCell>
                                <TableCell>Autor</TableCell>
                                <TableCell>Ver</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredContent.map((content) => (
                                <TableRow 
                                    key={content.id}
                                    hover
                                    onClick={() => handleContentToggle(content)}
                                    sx={{ cursor: 'pointer' }}
                                >
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={selectedContentProfiles.some(p => p.id === content.id)}
                                            disabled={maxSelections && selectedContentProfiles.length >= maxSelections && !selectedContentProfiles.some(p => p.id === content.id)}
                                        />
                                    </TableCell>
                                    <TableCell>{content.title || 'Sin título'}</TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={content.content.media_type} 
                                            size="small"
                                            color="primary"
                                        />
                                    </TableCell>
                                    <TableCell>{content.author || 'Desconocido'}</TableCell>
                                    <TableCell 
                                        onClick={(e) => e.stopPropagation()} // Prevent row click from triggering
                                    >
                                        <MuiLink
                                            href={`/content/${content.content.id}`}
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
                            {filteredContent.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} align="center">
                                        {searchQuery || selectedCollectionId !== null 
                                            ? 'No se encontró contenido con los filtros aplicados' 
                                            : 'No hay contenido disponible'}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default LibrarySelectMultiple; 