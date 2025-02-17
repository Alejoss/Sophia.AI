import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    IconButton, 
    Checkbox,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Button
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import contentApi from '../api/contentApi';

const CollectionAddContent = () => {
    const { collectionId } = useParams();
    const navigate = useNavigate();
    const [userContent, setUserContent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [addingContent, setAddingContent] = useState(false);

    useEffect(() => {
        const fetchUserContent = async () => {
            try {
                const data = await contentApi.getUserContent();
                // Filter out content that's already in this collection
                const filteredContent = data.filter(content => content.collection?.id !== parseInt(collectionId));
                setUserContent(filteredContent);
                setLoading(false);
            } catch (err) {
                setError('Failed to fetch your content');
                setLoading(false);
            }
        };

        fetchUserContent();
    }, [collectionId]);

    const handleAddToCollection = async (contentProfileId) => {
        setAddingContent(true);
        try {
            await contentApi.addContentToCollection(collectionId, contentProfileId);
            // Remove the added content from the list
            setUserContent(userContent.filter(content => content.id !== contentProfileId));
        } catch (error) {
            console.error('Failed to add content to collection:', error);
            alert('Failed to add content to collection. Please try again.');
        } finally {
            setAddingContent(false);
        }
    };

    if (loading) return <Typography>Loading your content...</Typography>;
    if (error) return <Typography color="error">{error}</Typography>;

    return (
        <Box sx={{ pt: 12, px: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <IconButton 
                    onClick={() => navigate(`/content/collections/${collectionId}`)} 
                    sx={{ mr: 2 }}
                >
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h4">
                    Add Content to Collection
                </Typography>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Add</TableCell>
                            <TableCell>Title</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Author</TableCell>
                            <TableCell>Notes</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {userContent.map((content) => (
                            <TableRow key={content.id}>
                                <TableCell>
                                    <Checkbox
                                        checked={false}
                                        onChange={() => handleAddToCollection(content.id)}
                                        disabled={addingContent}
                                    />
                                </TableCell>
                                <TableCell>{content.title || 'Untitled'}</TableCell>
                                <TableCell>{content.content.media_type}</TableCell>
                                <TableCell>{content.author || '-'}</TableCell>
                                <TableCell>{content.personal_note || '-'}</TableCell>
                            </TableRow>
                        ))}
                        {userContent.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    No content available to add
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default CollectionAddContent; 