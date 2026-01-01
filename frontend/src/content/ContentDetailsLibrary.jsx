import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Card, Typography, Box, Chip, Divider, Button, Stack } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import PersonIcon from '@mui/icons-material/Person';
import { formatDate } from '../utils/dateUtils';
import contentApi from '../api/contentApi';
import { AuthContext } from '../context/AuthContext';
import ContentReferences from './ContentReferences';
import ContentDisplay from './ContentDisplay';
import AddToLibraryModal from '../components/AddToLibraryModal';

// ContentDisplay Mode: "detailed" - Full content detail view in library context
const ContentDetailsLibrary = () => {
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [references, setReferences] = useState(null);
    const { contentId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { authState } = useContext(AuthContext);
    const currentUser = authState.user;

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Get context parameters from location state or query params
                const searchParams = new URLSearchParams(location.search);
                const context = searchParams.get('context') || 'library';
                const contextId = searchParams.get('userId') || currentUser?.id;

                const [contentData, referencesData] = await Promise.all([
                    contentApi.getContentDetails(contentId, context, contextId),
                    contentApi.getContentReferences(contentId)
                ]);
                
                setContent(contentData);
                setReferences(referencesData);
            } catch (err) {
                console.error('Error in ContentDetailsLibrary:', err);
                console.error('Error response:', err.response);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [contentId, location.search, currentUser]);

    if (loading) return <div>Cargando...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!content) return <div>No se encontró contenido</div>;

    const profile = content.selected_profile;
    
    // Determine if the current user is the owner of the profile
    const isOwner = profile?.user && currentUser && parseInt(profile.user) === parseInt(currentUser.id);
    
    // Get the username for the button text
    const ownerUsername = profile?.user_username || 'User';

    return (
        <Box sx={{ maxWidth: 800, margin: '0 auto', padding: 2, pt: 12 }}>
            {/* Action Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                {isOwner ? (
                    // Owner actions
                    <>
                        <Button
                            variant="outlined"
                            startIcon={<ArrowBackIcon />}
                            onClick={() => navigate('/content/library_user')}
                        >
                            Ir a tu biblioteca
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={() => navigate(`/content/${contentId}/edit`)}
                        >
                            Editar perfil de contenido
                        </Button>
                    </>
                ) : (
                    // Non-owner actions - only Add to Library button
                    <AddToLibraryModal
                        content={content}
                        onSuccess={() => {
                            // Optionally refresh the content or show success message
                            console.log('Content added to library successfully');
                        }}
                        buttonProps={{
                            variant: 'outlined',
                            size: 'medium'
                        }}
                    />
                )}
            </Box>

            <Card sx={{ padding: 3 }}>
                {/* Content Display */}
                <ContentDisplay 
                    content={content}
                    variant="detailed"
                    showAuthor={true}
                />

                {/* Content References Section */}
                {references && (
                    <Box sx={{ mt: 4 }}>
                        <ContentReferences references={references} />
                    </Box>
                )}
            </Card>
        </Box>
    );
};

const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return 'Tamaño desconocido';
    
    const size = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    
    if (size < 1024) {
        return `${size} bytes`;
    } else if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(2)} KB`;
    } else if (size < 1024 * 1024 * 1024) {
        return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    } else {
        return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
};

export default ContentDetailsLibrary; 