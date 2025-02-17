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
    Checkbox,
    Chip,
    Link as MuiLink
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import contentApi from '../api/contentApi';

const TopicEditContent = () => {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const [userContent, setUserContent] = useState([]);
    const [selectedContent, setSelectedContent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [contentData, topicData] = await Promise.all([
                    contentApi.getUserContent(),
                    contentApi.getTopicDetails(topicId)
                ]);
                setUserContent(contentData);
                // Initialize selected content with IDs of content already in the topic
                setSelectedContent(topicData.contents.map(content => content.id));
                setLoading(false);
            } catch (err) {
                setError('Failed to fetch data');
                setLoading(false);
            }
        };

        fetchData();
    }, [topicId]);

    const handleContentToggle = async (contentId) => {
        try {
            setSaving(true);
            if (selectedContent.includes(contentId)) {
                await contentApi.removeContentFromTopic(topicId, [contentId]);
                setSelectedContent(prev => prev.filter(id => id !== contentId));
            } else {
                await contentApi.addContentToTopic(topicId, [contentId]);
                setSelectedContent(prev => [...prev, contentId]);
            }
            setSaving(false);
        } catch (err) {
            setError('Failed to update topic content');
            setSaving(false);
        }
    };

    if (loading) return <Typography>Loading your content...</Typography>;
    if (error) return <Alert severity="error">{error}</Alert>;

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
                    <Typography variant="h4">
                        Edit Topic Content
                    </Typography>
                </Box>

                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        indeterminate={selectedContent.length > 0 && selectedContent.length < userContent.length}
                                        checked={selectedContent.length === userContent.length}
                                        onChange={(event) => {
                                            // Bulk operations could be implemented here
                                        }}
                                        disabled={saving}
                                    />
                                </TableCell>
                                <TableCell>Title</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Author</TableCell>
                                <TableCell>View</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {userContent.map((contentProfile) => (
                                <TableRow 
                                    key={contentProfile.id}
                                    hover
                                    onClick={() => !saving && handleContentToggle(contentProfile.content.id)}
                                    sx={{ cursor: saving ? 'wait' : 'pointer' }}
                                >
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={selectedContent.includes(contentProfile.content.id)}
                                            disabled={saving}
                                        />
                                    </TableCell>
                                    <TableCell>{contentProfile.title || 'Untitled'}</TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={contentProfile.content.media_type} 
                                            size="small"
                                            color="primary"
                                        />
                                    </TableCell>
                                    <TableCell>{contentProfile.author || 'Unknown'}</TableCell>
                                    <TableCell 
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <MuiLink
                                            href={`/content/${contentProfile.content.id}`}
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
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default TopicEditContent; 