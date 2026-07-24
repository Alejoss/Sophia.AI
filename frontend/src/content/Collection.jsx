import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Chip,
    IconButton,
    Button,
    TablePagination,
} from '@mui/material';
import NoteIcon from '@mui/icons-material/Note';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import contentApi from '../api/contentApi';
import { resolveMediaUrl } from '../utils/fileUtils';

const DEFAULT_PAGE_SIZE = 12;

const Collection = () => {
    const { collectionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [content, setContent] = useState([]);
    const [collectionName, setCollectionName] = useState('');
    const [isOwner, setIsOwner] = useState(false);
    const [ownerUsername, setOwnerUsername] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        const fetchCollectionMeta = async () => {
            try {
                const collectionInfo = await contentApi.getCollection(collectionId);
                setCollectionName(collectionInfo.name || 'Colección sin título');
                setIsOwner(!!collectionInfo.is_owner);
                setOwnerUsername(collectionInfo.owner_username || '');
            } catch (err) {
                console.error('Error fetching collection metadata:', err);
                setError(err.response?.data?.error || 'Error al obtener la colección');
                setLoading(false);
            }
        };

        fetchCollectionMeta();
    }, [collectionId]);

    const loadContentPage = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const contentData = await contentApi.getCollectionContent(collectionId, {
                page: page + 1,
                page_size: rowsPerPage,
            });
            const results = Array.isArray(contentData?.results)
                ? contentData.results
                : Array.isArray(contentData)
                  ? contentData
                  : [];
            setContent(results);
            setTotalCount(
                typeof contentData?.count === 'number' ? contentData.count : results.length
            );
        } catch (err) {
            console.error('Error fetching collection content:', err);
            setError(
                err.response?.data?.error || 'Error al obtener el contenido de la colección'
            );
        } finally {
            setLoading(false);
        }
    }, [collectionId, page, rowsPerPage]);

    useEffect(() => {
        loadContentPage();
    }, [loadContentPage]);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    if (loading && content.length === 0 && !error) {
        return <Typography>Cargando contenido de la colección...</Typography>;
    }
    if (error) return <Typography color="error">{error}</Typography>;

    const handleBack = () => {
        const returnTo = location.state?.from;
        if (returnTo) {
            navigate(returnTo);
            return;
        }
        if (isOwner) {
            navigate('/content/collections');
            return;
        }
        navigate(-1);
    };

    return (
        <Box sx={{ pt: 12, px: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
                <IconButton onClick={handleBack} sx={{ mr: 2 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                    <Typography variant="h1" sx={{ fontSize: '2.5rem' }}>
                        {collectionName}
                    </Typography>
                    {!isOwner && ownerUsername && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Colección de {ownerUsername}
                        </Typography>
                    )}
                    {totalCount > 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {totalCount} elementos
                        </Typography>
                    )}
                </Box>
                {isOwner ? (
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() =>
                            navigate(`/content/collections/${collectionId}/edit`, {
                                state: location.state,
                            })
                        }
                    >
                        Editar Colección
                    </Button>
                ) : (
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => navigate('/content/collections')}
                    >
                        Mis colecciones
                    </Button>
                )}
            </Box>

            <Box display="grid" gridTemplateColumns="repeat(12, 1fr)" gap={3}>
                {content.map((contentProfile) => (
                    <Box
                        gridColumn={{ xs: 'span 12', sm: 'span 6', md: 'span 4' }}
                        key={contentProfile.id}
                    >
                        <Card
                            sx={{ cursor: 'pointer' }}
                            onClick={() =>
                                navigate(
                                    `/content/${contentProfile.content.id}/library?context=library&id=${contentProfile.user}`
                                )
                            }
                        >
                            {contentProfile.content.media_type === 'IMAGE' &&
                                contentProfile.content.file_details?.file && (
                                    <Box
                                        sx={{
                                            width: '100%',
                                            height: 200,
                                            overflow: 'hidden',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <img
                                            src={resolveMediaUrl(
                                                contentProfile.content.file_details.url ??
                                                    contentProfile.content.file_details.file
                                            )}
                                            alt={contentProfile.title || 'Content image'}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                            }}
                                        />
                                    </Box>
                                )}
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <Typography variant="h6">
                                        {contentProfile.title || 'Sin título'}
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
                                            label={`Autor: ${contentProfile.author}`}
                                            size="small"
                                            variant="outlined"
                                        />
                                    )}
                                </Box>

                                <Typography variant="caption" color="text.secondary">
                                    Agregado:{' '}
                                    {contentProfile.content.file_details?.uploaded_at
                                        ? new Date(
                                              contentProfile.content.file_details.uploaded_at
                                          ).toLocaleDateString()
                                        : 'Fecha no disponible'}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>
                ))}

                {content.length === 0 && (
                    <Box gridColumn="span 12">
                        <Typography variant="body1" color="text.secondary" align="center">
                            Aún no hay contenido en esta colección.
                        </Typography>
                    </Box>
                )}
            </Box>

            {totalCount > 0 && (
                <TablePagination
                    component="div"
                    count={totalCount}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[12, 24, 48]}
                    labelRowsPerPage="Por página"
                    labelDisplayedRows={({ from, to, count }) =>
                        `${from}–${to} de ${count !== -1 ? count : `más de ${to}`}`
                    }
                    sx={{ mt: 2, borderTop: 1, borderColor: 'divider' }}
                />
            )}
        </Box>
    );
};

export default Collection;
