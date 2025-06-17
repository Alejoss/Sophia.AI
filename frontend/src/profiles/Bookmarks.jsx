import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Container,
    Typography,
    Paper,
    CircularProgress,
    Alert,
    Divider,
    IconButton,
    Tooltip,
    Stack
} from '@mui/material';
import { getBookmarks, deleteBookmark } from '../api/bookmarkApi';
import ImageIcon from '@mui/icons-material/Image';
import VideocamIcon from '@mui/icons-material/Videocam';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import ArticleIcon from '@mui/icons-material/Article';
import LinkIcon from '@mui/icons-material/Link';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import DeleteIcon from '@mui/icons-material/Delete';
import SchoolIcon from '@mui/icons-material/School';
import AddToLibraryModal from '../components/AddToLibraryModal';

// Separate component for media type icon
const MediaTypeIcon = ({ content }) => {
    console.log('\n=== MediaTypeIcon Component ===');
    console.log('Content prop:', content);
    
    // For content type bookmarks, the data is nested in content.content
    const contentData = content.content || content;
    console.log('Content data:', contentData);
    
    const hasFavicon = contentData?.favicon;
    const mediaType = contentData?.media_type;
    
    console.log('Has favicon?', !!hasFavicon);
    console.log('Media type:', mediaType);

    const iconProps = { fontSize: 'large', sx: { opacity: 0.7 } };
    const [showFallbackIcon, setShowFallbackIcon] = useState(false);

    // First check if content has a favicon
    if (hasFavicon && mediaType === 'TEXT') {
        return (
            <Box sx={{ 
                width: 24, 
                height: 24, 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
            }}>
                {showFallbackIcon ? (
                    <LinkIcon {...iconProps} />
                ) : (
                    <img 
                        src={contentData.favicon}
                        alt="Site Icon"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        onError={() => setShowFallbackIcon(true)}
                    />
                )}
            </Box>
        );
    }

    // Handle non-URL content or non-TEXT URL content
    console.log('Using media type for icon:', mediaType);
    
    switch (mediaType) {
        case 'VIDEO':
            return <VideocamIcon {...iconProps} />;
        case 'AUDIO':
            return <AudiotrackIcon {...iconProps} />;
        case 'TEXT':
            if (contentData?.url) {
                return <LinkIcon {...iconProps} />;
            }
            return <ArticleIcon {...iconProps} />;
        case 'IMAGE':
            return <ImageIcon {...iconProps} />;
        default:
            console.log('Using default icon for media type:', mediaType);
            return <DescriptionIcon {...iconProps} />;
    }
};

const Bookmarks = () => {
    const [bookmarks, setBookmarks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const fetchBookmarks = async () => {
        try {
            const bookmarksData = await getBookmarks();
            console.log('\n=== Bookmarks Data ===');
            console.log('Raw bookmarks:', bookmarksData);
            setBookmarks(bookmarksData);
        } catch (err) {
            console.error('Failed to load bookmarks:', err);
            setError('Failed to load bookmarks');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBookmarks();
    }, []);

    const handleBookmarkClick = (bookmark) => {
        console.log('\n=== Bookmark Click ===');
        console.log('Bookmark data:', bookmark);
        const { content_type_name, object_id, topic } = bookmark;
        
        if (content_type_name === 'content') {
            if (topic) {
                navigate(`/content/${object_id}/topic/${topic.id}`);
            } else {
                navigate(`/content/${object_id}/library`);
            }
        } else if (content_type_name === 'knowledgepath') {
            navigate(`/knowledge_path/${object_id}`);
        } else if (content_type_name === 'publication') {
            navigate(`/publications/${object_id}`);
        }
    };

    const handleDelete = async (bookmarkId, event) => {
        event.stopPropagation();
        try {
            await deleteBookmark(bookmarkId);
            fetchBookmarks();
        } catch (error) {
            setError('Failed to delete bookmark');
        }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Container maxWidth="lg">
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg">
            <Paper sx={{ p: 3, mt: 3 }}>
                <Typography variant="h4" gutterBottom>
                    My Bookmarks
                </Typography>
                
                {bookmarks.length === 0 ? (
                    <Typography variant="body1" align="center" sx={{ py: 4 }}>
                        No saved items
                    </Typography>
                ) : (
                    <Box>
                        {bookmarks.map((bookmark, index) => {
                            console.log('\n=== Rendering Bookmark ===');
                            console.log('Bookmark:', bookmark);
                            console.log('Content object:', bookmark.content_object);
                            return (
                                <Box key={bookmark.id}>
                                    <Box
                                        onClick={() => handleBookmarkClick(bookmark)}
                                        sx={{ 
                                            cursor: 'pointer',
                                            '&:hover': {
                                                backgroundColor: 'action.hover'
                                            },
                                            p: 2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2
                                        }}
                                    >
                                        {bookmark.content_type_name === 'content' && (
                                            <>
                                                <Box sx={{ 
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: 40,
                                                    height: 40,
                                                    backgroundColor: 'background.paper',
                                                    borderRadius: 1,
                                                    overflow: 'hidden'
                                                }}>
                                                    <MediaTypeIcon content={bookmark.content_object} />
                                                </Box>
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography variant="h6" color="text.primary">
                                                        {bookmark.content_object?.title || 
                                                         bookmark.content_object?.selected_profile?.title || 
                                                         bookmark.content_object?.original_title || 
                                                         'Untitled Content'}
                                                    </Typography>
                                                    {(bookmark.content_object?.selected_profile?.author || bookmark.content_object?.original_author) && (
                                                        <Typography variant="body2" color="text.secondary">
                                                            By {bookmark.content_object.selected_profile?.author || bookmark.content_object.original_author}
                                                        </Typography>
                                                    )}
                                                </Box>
                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                    <AddToLibraryModal 
                                                        content={bookmark.content_object}
                                                        onSuccess={fetchBookmarks}
                                                    />
                                                    <Tooltip title="Delete bookmark">
                                                        <IconButton 
                                                            onClick={(e) => handleDelete(bookmark.id, e)}
                                                            color="error"
                                                            size="small"
                                                        >
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </>
                                        )}
                                        {bookmark.content_type_name === 'knowledgepath' && (
                                            <>
                                                <Box sx={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    width: 60,
                                                    height: 60,
                                                    backgroundColor: 'background.paper',
                                                    borderRadius: 1
                                                }}>
                                                    <SchoolIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                                                </Box>
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography variant="h6" color="text.primary">
                                                        {bookmark.content_object?.title || 'Untitled Knowledge Path'}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Knowledge Path
                                                    </Typography>
                                                </Box>
                                                <Tooltip title="Delete bookmark">
                                                    <IconButton 
                                                        onClick={(e) => handleDelete(bookmark.id, e)}
                                                        color="error"
                                                        size="small"
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </>
                                        )}
                                        {bookmark.content_type_name === 'publication' && (
                                            <>
                                                <Box sx={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    width: 60,
                                                    height: 60,
                                                    backgroundColor: 'background.paper',
                                                    borderRadius: 1
                                                }}>
                                                    <ArticleIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                                                </Box>
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography variant="h6" color="text.primary">
                                                        {bookmark.content_object?.title || 'Untitled Publication'}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Publication
                                                    </Typography>
                                                </Box>
                                                <Tooltip title="Delete bookmark">
                                                    <IconButton 
                                                        onClick={(e) => handleDelete(bookmark.id, e)}
                                                        color="error"
                                                        size="small"
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </>
                                        )}
                                    </Box>
                                    {index < bookmarks.length - 1 && <Divider />}
                                </Box>
                            );
                        })}
                    </Box>
                )}
            </Paper>
        </Container>
    );
};

export default Bookmarks;
