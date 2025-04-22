import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    Paper,
    Button,
    Alert,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Link as MuiLink,
    Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import contentApi from '../api/contentApi';
import LibrarySelectMultiple from '../content/LibrarySelectMultiple';

const TopicEditContent = () => {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const [topicData, setTopicData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showAddContent, setShowAddContent] = useState(false);

    useEffect(() => {
        const fetchTopicContent = async () => {
            try {
                const data = await contentApi.getTopicDetails(topicId);
                setTopicData(data);
                setLoading(false);
            } catch (err) {
                setError('Failed to fetch topic content');
                setLoading(false);
            }
        };

        fetchTopicContent();
    }, [topicId]);

    const handleContentRemove = async (contentId) => {
        try {
            setSaving(true);
            await contentApi.removeContentFromTopic(topicId, [contentId]);
            setTopicData(prev => ({
                ...prev,
                contents: prev.contents.filter(content => content.id !== contentId)
            }));
            setSaving(false);
        } catch (err) {
            setError('Failed to remove content from topic');
            setSaving(false);
        }
    };

    const handleCancelAdd = () => {
        setShowAddContent(false);
    };

    const handleSaveAdd = async (selectedContentProfileIds) => {
        try {
            setSaving(true);
            // Make a single API call with all selected content profile IDs
            await contentApi.addContentToTopic(topicId, selectedContentProfileIds);
            // Refresh topic content
            const data = await contentApi.getTopicDetails(topicId);
            setTopicData(data);
            setShowAddContent(false);
            setSaving(false);
        } catch (error) {
            console.error('Failed to add content to topic:', error);
            setError('Failed to add content to topic');
            setSaving(false);
        }
    };

    const filterContent = (content) => {
        // Filter out content that's already in this topic
        // Now topics are serialized as IDs, so we can directly compare them
        const isInTopic = content.content.topics?.some(topicIdInArray => topicIdInArray === parseInt(topicId));
        
        console.log('TopicEditContent filtering content:', {
            contentId: content.id,
            contentTitle: content.title,
            topicId: topicId,
            isInTopic,
            topics: content.content.topics,
            contentStructure: JSON.stringify(content, null, 2)
        });
        return !isInTopic;
    };

    if (loading) return <Typography>Loading topic content...</Typography>;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!topicData) return <Alert severity="error">Topic not found</Alert>;

    if (showAddContent) {
        return (
            <LibrarySelectMultiple
                title="Add Content to Topic"
                description="Select content from your library to add to this topic"
                onCancel={handleCancelAdd}
                onSave={handleSaveAdd}
                filterFunction={filterContent}
                contextName={topicData.title}
            />
        );
    }

    return (
        <Box sx={{ pt: 12, px: 3, maxWidth: 1200, mx: 'auto' }}>
            <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <IconButton 
                        onClick={() => navigate(`/content/topics/${topicId}/edit`)}
                        sx={{ mr: 2 }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h4" sx={{ flexGrow: 1 }}>
                        {topicData.title}
                    </Typography>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={() => setShowAddContent(true)}
                    >
                        Add content from your library
                    </Button>
                </Box>

                {topicData.description && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="body1" color="text.secondary">
                            {topicData.description}
                        </Typography>
                    </Box>
                )}

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" sx={{ mb: 2 }}>
                    Content in Topic ({topicData.contents.length})
                </Typography>

                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Title</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Author</TableCell>
                                <TableCell>View</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {topicData.contents.map((content) => (
                                <TableRow 
                                    key={content.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                >
                                    <TableCell>{content.selected_profile?.title || content.original_title || 'Untitled'}</TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={content.media_type} 
                                            size="small"
                                            color="primary"
                                        />
                                    </TableCell>
                                    <TableCell>{content.selected_profile?.author || content.original_author || 'Unknown'}</TableCell>
                                    <TableCell>
                                        <MuiLink
                                            href={`/content/${content.id}`}
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
                                    <TableCell>
                                        <Button
                                            variant="outlined"
                                            color="error"
                                            size="small"
                                            onClick={() => handleContentRemove(content.id)}
                                            disabled={saving}
                                        >
                                            Remove
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default TopicEditContent; 