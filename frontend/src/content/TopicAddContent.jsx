import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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

const TopicAddContent = () => {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const [userContent, setUserContent] = useState([]);
    const [selectedContent, setSelectedContent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchUserContent = async () => {
            try {
                const data = await contentApi.getUserContent();
                setUserContent(data);
                setLoading(false);
            } catch (err) {
                setError('Failed to fetch your content');
                setLoading(false);
            }
        };

        fetchUserContent();
    }, []);

    const handleContentToggle = (contentId) => {
        setSelectedContent(prev => {
            if (prev.includes(contentId)) {
                return prev.filter(id => id !== contentId);
            } else {
                return [...prev, contentId];
            }
        });
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await contentApi.addContentToTopic(topicId, selectedContent);
            navigate(`/content/topics/${topicId}/edit`);
        } catch (err) {
            setError('Failed to add content to topic');
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
                        Add Content to Topic
                    </Typography>
                </Box>

                <Box sx={{ mb: 3 }}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSubmit}
                        disabled={selectedContent.length === 0 || saving}
                    >
                        {saving ? 'Adding...' : `Add Selected Content (${selectedContent.length})`}
                    </Button>
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
                                            if (event.target.checked) {
                                                setSelectedContent(userContent.map(item => item.content.id));
                                            } else {
                                                setSelectedContent([]);
                                            }
                                        }}
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
                                    onClick={() => handleContentToggle(contentProfile.content.id)}
                                    sx={{ cursor: 'pointer' }}
                                >
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={selectedContent.includes(contentProfile.content.id)}
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
                                        onClick={(e) => e.stopPropagation()} // Prevent row click from triggering
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

export default TopicAddContent; 