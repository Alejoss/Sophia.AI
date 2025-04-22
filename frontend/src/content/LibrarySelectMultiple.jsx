import React, { useState, useEffect } from 'react';
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
    Divider
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import contentApi from '../api/contentApi';

const LibrarySelectMultiple = ({ 
    onCancel, 
    onSave, 
    onSelectionChange,
    title = "Select Content from Library",
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
                setError('Failed to fetch your content');
                setLoading(false);
            }
        };

        fetchUserContent();
        
        return () => {
            console.log('LibrarySelectMultiple useEffect cleanup');
        };
    }, [filterFunction]);

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
            totalItems: userContent.length
        });
        
        let newSelection;
        if (event.target.checked) {
            newSelection = maxSelections ? userContent.slice(0, maxSelections) : userContent;
            console.log('Selecting all:', {
                selectedIds: newSelection.map(p => p.id),
                limited: maxSelections ? 'yes' : 'no'
            });
        } else {
            console.log('Clearing all selections');
            newSelection = [];
        }
        
        setSelectedContentProfiles(newSelection);
        
        // Notify parent of selection change
        if (onSelectionChange) {
            onSelectionChange(newSelection);
        }
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
            setError('Failed to save selections');
            setSaving(false);
        }
    };

    if (loading) return <Typography>Loading your content...</Typography>;
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
                            Maximum {maxSelections} items can be selected
                        </Typography>
                    )}
                </Box>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">
                        Available Content ({userContent.length})
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            onClick={onCancel}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSubmit}
                            disabled={selectedContentProfiles.length === 0 || saving}
                        >
                            {saving ? 'Saving...' : `Save Selected (${selectedContentProfiles.length})`}
                        </Button>
                    </Box>
                </Box>

                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        indeterminate={selectedContentProfiles.length > 0 && selectedContentProfiles.length < userContent.length}
                                        checked={userContent.length > 0 && selectedContentProfiles.length === userContent.length}
                                        onChange={handleSelectAll}
                                        disabled={maxSelections && selectedContentProfiles.length >= maxSelections}
                                    />
                                </TableCell>
                                <TableCell>Title</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Author</TableCell>
                                <TableCell>View</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {userContent.map((content) => (
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
                                    <TableCell>{content.title || 'Untitled'}</TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={content.content.media_type} 
                                            size="small"
                                            color="primary"
                                        />
                                    </TableCell>
                                    <TableCell>{content.author || 'Unknown'}</TableCell>
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
                                            View
                                            <OpenInNewIcon fontSize="small" />
                                        </MuiLink>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {userContent.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} align="center">
                                        No content available
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