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
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import contentApi from '../api/contentApi';

const CollectionEditContent = () => {
    const { collectionId } = useParams();
    const navigate = useNavigate();
    const [userContent, setUserContent] = useState([]);
    const [collectionContent, setCollectionContent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch both user content and collection content in parallel
                const [userData, collectionData] = await Promise.all([
                    contentApi.getUserContent(),
                    contentApi.getCollectionContent(collectionId)
                ]);
                
                console.log('Fetched user data:', userData);
                console.log('Fetched collection data:', collectionData);
                
                setUserContent(userData);
                setCollectionContent(collectionData);
                setLoading(false);
            } catch (err) {
                console.error('Detailed fetch error:', err);
                setError(err.response?.data?.error || 'Failed to fetch content');
                setLoading(false);
            }
        };

        fetchData();
    }, [collectionId]);

    const isInCollection = (content) => {
        // Check if this content's ID exists in the collection content
        return collectionContent.some(item => item.id === content.id);
    };

    const handleToggleContent = async (contentProfile) => {
        setProcessing(true);
        try {
            if (isInCollection(contentProfile)) {
                // Remove from collection
                await contentApi.removeContentFromCollection(contentProfile.id);
                // Update collectionContent by removing the item
                setCollectionContent(collectionContent.filter(item => item.id !== contentProfile.id));
            } else {
                // Add to collection
                await contentApi.addContentToCollection(collectionId, contentProfile.id);
                // Update collectionContent by adding the item
                setCollectionContent([...collectionContent, contentProfile]);
            }
        } catch (error) {
            console.error('Failed to update collection:', error);
            alert('Failed to update collection. Please try again.');
        } finally {
            setProcessing(false);
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
                    Edit Collection Content
                </Typography>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>In Collection</TableCell>
                            <TableCell>Title</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Author</TableCell>
                            <TableCell>Notes</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {userContent.map((content) => (
                            <TableRow 
                                key={content.id}
                                sx={{ 
                                    backgroundColor: isInCollection(content)
                                        ? 'rgba(25, 118, 210, 0.08)' 
                                        : 'inherit'
                                }}
                            >
                                <TableCell>
                                    <Checkbox
                                        checked={isInCollection(content)}
                                        onChange={() => handleToggleContent(content)}
                                        disabled={processing}
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
                                    No content available
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default CollectionEditContent; 