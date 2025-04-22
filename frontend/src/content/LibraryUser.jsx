import React, { useState, useEffect, useContext } from 'react';
import { Box, Typography, Card, CardContent, Chip, ToggleButton, ToggleButtonGroup, IconButton, Button } from '@mui/material';
import NoteIcon from '@mui/icons-material/Note';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { isAuthenticated } from '../context/localStorageUtils';
import contentApi from '../api/contentApi';
import { useNavigate, useParams } from 'react-router-dom';
import { getFileUrl } from '../utils/fileUtils';
import { AuthContext } from '../context/AuthContext';

const LibraryUser = () => {
    // TODO order by most recent by default
    const [userContent, setUserContent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [mediaFilter, setMediaFilter] = useState('ALL');
    const [userName, setUserName] = useState('');
    const navigate = useNavigate();
    const { userId } = useParams();
    const { authState } = useContext(AuthContext);
    const currentUser = authState.user;
    const isOwnLibrary = !userId || (currentUser && userId === currentUser.id.toString());

    useEffect(() => {
        const fetchUserContent = async () => {
            try {
                let data;
                if (userId) {
                    // Fetch content for the specified user
                    data = await contentApi.getUserContentById(userId);
                    // You might need to implement this API method
                } else {
                    // Fetch content for the current user
                    data = await contentApi.getUserContent();
                }
                setUserContent(data);
                setLoading(false);
            } catch (err) {
                setError('Failed to fetch content');
                setLoading(false);
            }
        };

        if (isAuthenticated()) {
            fetchUserContent();
        }
    }, [userId]);

    const handleFilterChange = (event, newFilter) => {
        setMediaFilter(newFilter || 'ALL');
    };

    const filteredContent = userContent.filter(contentProfile => 
        mediaFilter === 'ALL' || contentProfile.content.media_type === mediaFilter
    );

    if (loading) return <Typography>Loading content...</Typography>;
    if (error) return <Typography color="error">{error}</Typography>;
    if (!isAuthenticated()) return <Typography>Please login to view content</Typography>;

    return (
        <Box sx={{ pt: 12, px: 3 }}>
            <Typography variant="h4" gutterBottom>
                {isOwnLibrary ? "My Content Library" : `${userName || 'User'}'s Content Library`}
            </Typography>

            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <ToggleButtonGroup
                    value={mediaFilter}
                    exclusive
                    onChange={handleFilterChange}
                    aria-label="media type filter"
                >
                    <ToggleButton value="ALL">All</ToggleButton>
                    <ToggleButton value="IMAGE">Images</ToggleButton>
                    <ToggleButton value="TEXT">Text</ToggleButton>
                    <ToggleButton value="VIDEO">Video</ToggleButton>
                    <ToggleButton value="AUDIO">Audio</ToggleButton>
                </ToggleButtonGroup>

                {isOwnLibrary && (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button 
                            variant="contained" 
                            color="primary"
                            onClick={() => navigate('/content/collections')}
                        >
                            Collections
                        </Button>

                        <Button 
                            variant="contained" 
                            color="primary"
                            startIcon={<UploadFileIcon />}
                            onClick={() => navigate('/content/upload_content_library')}
                        >
                            Upload Content
                        </Button>
                    </Box>
                )}
            </Box>
            
            {mediaFilter === 'TEXT' ? (
                // Table view for text files
                <Box sx={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '12px' }}>Title</th>
                                <th style={{ textAlign: 'left', padding: '12px' }}>Author</th>
                                <th style={{ textAlign: 'left', padding: '12px' }}>Notes</th>
                                <th style={{ textAlign: 'left', padding: '12px' }}>File</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredContent.map((contentProfile) => (
                                <tr 
                                    key={contentProfile.id} 
                                    style={{ 
                                        borderBottom: '1px solid #eee',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => navigate(`/content/${contentProfile.content.id}/library`)}
                                >
                                    <td style={{ padding: '12px' }}>{contentProfile.title}</td>
                                    <td style={{ padding: '12px' }}>{contentProfile.author}</td>
                                    <td style={{ padding: '12px' }}>
                                        {contentProfile.personal_note && (
                                            <IconButton size="small" title={contentProfile.personal_note}>
                                                <NoteIcon color="primary" />
                                            </IconButton>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        {contentProfile.content.file_details?.file && (
                                            <a 
                                                href={getFileUrl(contentProfile.content.file_details.file)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Download
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Box>
            ) : (
                // Grid view for other media types
                <Box display="grid" gridTemplateColumns="repeat(12, 1fr)" gap={3}>
                    {filteredContent.map((contentProfile) => (
                        <Box gridColumn={{ xs: "span 12", sm: "span 6", md: "span 4" }} key={contentProfile.id}>
                            <Card 
                                sx={{ cursor: 'pointer' }}
                                onClick={() => navigate(`/content/${contentProfile.content.id}/library`)}
                            >
                                {contentProfile.content.media_type === 'IMAGE' && contentProfile.content.file_details?.file && (
                                    <Box sx={{ 
                                        width: '100%', 
                                        height: 200, 
                                        overflow: 'hidden',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <img 
                                            src={getFileUrl(contentProfile.content.file_details.file)} 
                                            alt={contentProfile.title || 'Content image'}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover'
                                            }}
                                        />
                                    </Box>
                                )}
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Typography variant="h6">
                                            {contentProfile.title || 'Untitled'}
                                        </Typography>
                                        {contentProfile.personal_note && (
                                            <IconButton size="small" title={contentProfile.personal_note}>
                                                <NoteIcon color="primary" />
                                            </IconButton>
                                        )}
                                    </Box>
                                    
                                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                        <Chip 
                                            label={contentProfile.content.media_type} 
                                            size="small"
                                            color="primary"
                                        />
                                        {contentProfile.author && (
                                            <Chip 
                                                label={`Author: ${contentProfile.author}`}
                                                size="small"
                                                variant="outlined"
                                            />
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                        </Box>
                    ))}

                    {filteredContent.length === 0 && (
                        <Box gridColumn={{ xs: "span 12" }}>
                            <Typography variant="body1" color="text.secondary" align="center">
                                No content found for the selected filter.
                            </Typography>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
};

export default LibraryUser; 
