import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    Box,
    Typography,
    IconButton,
    Button,
    TablePagination,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';
import ContentDisplay from './ContentDisplay';
import { AuthContext } from '../context/AuthContext';

const DEFAULT_PAGE_SIZE = 24;

const Collection = () => {
    const { t } = useTranslation('content');
    const { collectionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { authState } = useContext(AuthContext) || {};
    const isAuthenticated = Boolean(authState?.isAuthenticated);
    const [content, setContent] = useState([]);
    const [collectionName, setCollectionName] = useState('');
    const [collectionDescription, setCollectionDescription] = useState('');
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
                setCollectionName(collectionInfo.name || t('collections.untitled'));
                setCollectionDescription(collectionInfo.description || '');
                setIsOwner(!!collectionInfo.is_owner);
                setOwnerUsername(collectionInfo.owner_username || '');
            } catch (err) {
                console.error('Error fetching collection metadata:', err);
                setError(err.response?.data?.error || t('collections.fetchError'));
                setLoading(false);
            }
        };

        fetchCollectionMeta();
    }, [collectionId, t]);

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
                err.response?.data?.error || t('collections.fetchContentError')
            );
        } finally {
            setLoading(false);
        }
    }, [collectionId, page, rowsPerPage, t]);

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
        return <Typography>{t('collections.loadingContent')}</Typography>;
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
                    {collectionDescription && (
                        <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 720 }}>
                            {collectionDescription}
                        </Typography>
                    )}
                    {!isOwner && ownerUsername && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {t('collections.byOwner', { name: ownerUsername })}
                        </Typography>
                    )}
                    {totalCount > 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {t('collections.elementCount', { value: totalCount })}
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
                        {t('collections.edit')}
                    </Button>
                ) : isAuthenticated ? (
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => navigate('/content/collections')}
                    >
                        {t('collections.mineButton')}
                    </Button>
                ) : null}
            </Box>

            <Box display="grid" gridTemplateColumns="repeat(12, 1fr)" gap={3}>
                {content.map((contentProfile) => (
                    <Box
                        gridColumn={{ xs: 'span 12', sm: 'span 6', md: 'span 4' }}
                        key={contentProfile.id}
                    >
                        <ContentDisplay
                            content={contentProfile}
                            variant="card"
                            showAuthor={true}
                            onClick={() =>
                                navigate(
                                    `/content/${contentProfile.content.id}/library?context=library&id=${contentProfile.user}`
                                )
                            }
                        />
                    </Box>
                ))}
            </Box>

            {content.length === 0 && !loading && (
                <Typography variant="body1" color="text.secondary" align="center" sx={{ mt: 4 }}>
                    {t('collections.emptyContent')}
                </Typography>
            )}

            {totalCount > 0 && (
                <TablePagination
                    component="div"
                    count={totalCount}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[24, 48, 96]}
                    labelRowsPerPage={t('pagination.rowsPerPage')}
                    sx={{ mt: 2 }}
                />
            )}
        </Box>
    );
};

export default Collection;
