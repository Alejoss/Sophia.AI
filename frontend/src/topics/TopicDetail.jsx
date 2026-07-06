import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink, useSearchParams } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    Button,
    Grid,
    Link,
    Dialog,
    IconButton,
    useMediaQuery,
    Tabs,
    Tab,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import ListIcon from '@mui/icons-material/List';
import contentApi from '../api/contentApi';
import { resolveMediaUrl } from '../utils/fileUtils';
import { useAuth } from '../context/AuthContext';
import CommentSection from '../comments/CommentSection';
import TopicHeader from './TopicHeader';
import ContentDisplay from '../content/ContentDisplay';
import VoteComponent from '../votes/VoteComponent';
import ContentSuggestionModal from './ContentSuggestionModal';
import TopicTimeline from './timeline/TopicTimeline';

/** Same value for every topic-image API page request; mixed page_size breaks DRF page offsets. */
const TOPIC_IMAGE_PAGE_SIZE = 3;

function getGalleryImageSrc(content) {
    const contentData = content.content || content;
    const fileDetails = contentData.file_details;
    const customThumb =
        content.selected_profile?.thumbnail_preview ||
        content.thumbnail_preview ||
        content.selected_profile?.thumbnail ||
        content.thumbnail;
    if (customThumb) {
        const resolved = resolveMediaUrl(customThumb);
        return resolved || customThumb;
    }
    if (fileDetails?.file) {
        const u = resolveMediaUrl(fileDetails.url ?? fileDetails.file);
        if (u) return u;
    }
    if (fileDetails?.og_image) return fileDetails.og_image;
    return null;
}

function TopicGalleryThumb({ src, titleText, onOpen }) {
    const [failed, setFailed] = useState(false);
    const showImg = src && !failed;

    return (
        <Box
            component="button"
            type="button"
            onClick={onOpen}
            aria-label={`Ampliar imagen: ${titleText}`}
            sx={{
                display: 'block',
                width: '100%',
                border: 'none',
                padding: 0,
                margin: 0,
                cursor: 'pointer',
                position: 'relative',
                aspectRatio: '1',
                bgcolor: 'grey.100',
                '&:hover': { opacity: 0.92 },
            }}
        >
            {showImg ? (
                <Box
                    component="img"
                    src={src}
                    alt={titleText}
                    sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                    }}
                    onError={() => setFailed(true)}
                />
            ) : (
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 1,
                    }}
                >
                    <Typography variant="caption" color="text.secondary" align="center">
                        Sin vista previa
                    </Typography>
                </Box>
            )}
        </Box>
    );
}

function TopicImageLightbox({
    open,
    onClose,
    items,
    index,
    onIndexChange,
    topicId,
    navigate,
    hasNextPage,
    onRequestNextPage,
    isLoadingNextPage,
}) {
    const n = items?.length ?? 0;
    const safeIndex = n === 0 ? 0 : Math.min(Math.max(0, index), n - 1);
    const content = n > 0 ? items[safeIndex] : null;
    const [imgFailed, setImgFailed] = useState(false);

    const profile = content ? (content.selected_profile || content) : null;
    const titleText = profile ? (profile.title || content.original_title || 'Sin título') : '';
    const contentData = content ? (content.content || content) : null;
    const contentId = contentData?.id;
    const src = content ? getGalleryImageSrc(content) : null;

    useEffect(() => {
        setImgFailed(false);
    }, [safeIndex, open, src]);

    const goPrevious = useCallback(() => {
        if (safeIndex > 0) {
            onIndexChange(safeIndex - 1);
        }
    }, [safeIndex, onIndexChange]);

    const goNext = useCallback(async () => {
        if (safeIndex < n - 1) {
            onIndexChange(safeIndex + 1);
            return;
        }
        if (hasNextPage && onRequestNextPage && !isLoadingNextPage) {
            const loaded = await onRequestNextPage();
            if (loaded) {
                onIndexChange(safeIndex + 1);
            }
        }
    }, [safeIndex, n, onIndexChange, hasNextPage, onRequestNextPage, isLoadingNextPage]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = async (e) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key === 'ArrowLeft') {
                goPrevious();
            }
            if (e.key === 'ArrowRight') {
                await goNext();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose, goPrevious, goNext]);

    if (!open || !content || !contentId) {
        return null;
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen
            PaperProps={{
                sx: {
                    bgcolor: 'grey.900',
                    color: 'common.white',
                    backgroundImage: 'none',
                },
            }}
            slotProps={{
                backdrop: { sx: { bgcolor: 'rgba(0,0,0,0.9)' } },
            }}
        >
            <Box
                sx={{
                    position: 'relative',
                    minHeight: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    pt: 1,
                    pb: 2,
                    px: { xs: 1, sm: 2 },
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ color: 'grey.400' }}>
                        {safeIndex + 1} / {n}
                    </Typography>
                    <IconButton onClick={onClose} aria-label="Cerrar galería" sx={{ color: 'common.white' }}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                <Box
                    sx={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        minHeight: { xs: '50vh', sm: '60vh' },
                        gap: 0.5,
                    }}
                >
                    <IconButton
                        onClick={goPrevious}
                        disabled={safeIndex <= 0}
                        aria-label="Imagen anterior"
                        sx={{
                            color: 'common.white',
                            flexShrink: 0,
                            '&.Mui-disabled': { color: 'grey.700' },
                        }}
                    >
                        <ChevronLeftIcon sx={{ fontSize: 40 }} />
                    </IconButton>

                    <Box
                        sx={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 0,
                            maxHeight: { xs: '65vh', sm: '75vh' },
                        }}
                    >
                        {src && !imgFailed ? (
                            <Box
                                component="img"
                                src={src}
                                alt={titleText}
                                sx={{
                                    maxWidth: '100%',
                                    maxHeight: { xs: '65vh', sm: '75vh' },
                                    objectFit: 'contain',
                                }}
                                onError={() => setImgFailed(true)}
                            />
                        ) : (
                            <Typography color="grey.400">Sin vista previa</Typography>
                        )}
                    </Box>

                    <IconButton
                        onClick={goNext}
                        disabled={(safeIndex >= n - 1 && !hasNextPage) || isLoadingNextPage}
                        aria-label="Imagen siguiente"
                        sx={{
                            color: 'common.white',
                            flexShrink: 0,
                            '&.Mui-disabled': { color: 'grey.700' },
                        }}
                    >
                        <ChevronRightIcon sx={{ fontSize: 40 }} />
                    </IconButton>
                </Box>

                <Box sx={{ mt: 2, textAlign: 'center', maxWidth: 720, mx: 'auto', width: '100%' }}>
                    <Typography variant="subtitle1" sx={{ mb: 0.5, px: 1 }}>
                        {titleText}
                    </Typography>
                    {isLoadingNextPage && (
                        <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'grey.400' }}>
                            Cargando más imágenes...
                        </Typography>
                    )}
                    {contentData.vote_count !== undefined && topicId && (
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                mb: 1,
                                '& .MuiIconButton-root': { color: 'common.white' },
                                '& .MuiTypography-root': { color: 'common.white' },
                            }}
                        >
                            <VoteComponent
                                key={contentId}
                                type="content"
                                ids={{ topicId, contentId }}
                                initialVoteCount={contentData.vote_count ?? 0}
                                initialUserVote={contentData.user_vote ?? 0}
                            />
                        </Box>
                    )}
                    <Button
                        variant="outlined"
                        color="inherit"
                        size="small"
                        onClick={() => {
                            navigate(`/content/${contentId}/topic/${topicId}`);
                            onClose();
                        }}
                    >
                        Abrir ficha del contenido
                    </Button>
                </Box>
            </Box>
        </Dialog>
    );
}

const TopicDetail = () => {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, isAuthenticated } = useAuth();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [topic, setTopic] = useState(null);
    const [contentByType, setContentByType] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
    const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState(0);
    const [pendingTimelineSuggestionsCount, setPendingTimelineSuggestionsCount] = useState(0);
    const [pendingTimelineEntryContentSuggestionsCount, setPendingTimelineEntryContentSuggestionsCount] = useState(0);
    const [isModerator, setIsModerator] = useState(false);
    const [imageLightboxOpen, setImageLightboxOpen] = useState(false);
    const [imageLightboxIndex, setImageLightboxIndex] = useState(0);
    const [contentCounts, setContentCounts] = useState({});
    const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'content');
    const [timelineEntryCount, setTimelineEntryCount] = useState(0);
    const [imagePageInfo, setImagePageInfo] = useState({
        currentPage: 0,
        totalPages: 0,
        hasNext: false,
        loading: false,
    });

    const fetchContentByTypePage = useCallback(async (mediaType, page, pageSize) => {
        return contentApi.getTopicContentByType(topicId, mediaType, {
            page,
            page_size: pageSize,
        });
    }, [topicId]);

    const fetchPendingTimelineSuggestionsCount = useCallback(async () => {
        try {
            const [entrySuggestions, entryContentSuggestions] = await Promise.all([
                contentApi.getTopicTimelineEntrySuggestions(topicId, { status: 'PENDING' }),
                contentApi.getTopicTimelineEntryContentSuggestions(topicId, { status: 'PENDING' }),
            ]);
            setPendingTimelineSuggestionsCount(Array.isArray(entrySuggestions) ? entrySuggestions.length : 0);
            setPendingTimelineEntryContentSuggestionsCount(
                Array.isArray(entryContentSuggestions) ? entryContentSuggestions.length : 0,
            );
        } catch {
            // ignore
        }
    }, [topicId]);

    const fetchPendingSuggestionsCount = useCallback(async () => {
        try {
            const suggestions = await contentApi.getTopicContentSuggestions(topicId, { status: 'PENDING' });
            setPendingSuggestionsCount(Array.isArray(suggestions) ? suggestions.length : 0);
        } catch {
            // ignore
        }
    }, [topicId]);

    const refreshTopicPageData = useCallback(async () => {
        setLoading(true);
        try {
            const [topicData, imageData, videoData, audioData, textData, timelineData] = await Promise.all([
                contentApi.getTopicDetails(topicId, { include_contents: false }),
                fetchContentByTypePage('image', 1, TOPIC_IMAGE_PAGE_SIZE),
                fetchContentByTypePage('video', 1, 3),
                fetchContentByTypePage('audio', 1, 3),
                fetchContentByTypePage('text', 1, 3),
                contentApi.getTopicTimeline(topicId).catch(() => ({ entries: [] })),
            ]);

            setTopic(topicData);
            setContentByType({
                image: imageData.contents || imageData.results || [],
                video: videoData.contents || [],
                audio: audioData.contents || [],
                text: textData.contents || [],
            });
            setContentCounts({
                image: imageData.count ?? (imageData.contents || []).length,
                video: videoData.count ?? (videoData.contents || []).length,
                audio: audioData.count ?? (audioData.contents || []).length,
                text: textData.count ?? (textData.contents || []).length,
            });
            setTimelineEntryCount((timelineData.entries || []).length);
            setImagePageInfo({
                currentPage: imageData.current_page ?? 1,
                totalPages: imageData.total_pages ?? 1,
                hasNext: Boolean(imageData.has_next),
                loading: false,
            });

            const creatorId = typeof topicData.creator === 'object' ? topicData.creator.id : topicData.creator;
            const currentUserId = user?.id;
            const creatorMatches =
                isAuthenticated &&
                creatorId != null &&
                currentUserId != null &&
                String(creatorId) === String(currentUserId);
            const userIsModerator = creatorMatches || (
                isAuthenticated &&
                (topicData.moderators || []).some(mod => String(mod.id) === String(currentUserId))
            );
            setIsModerator(userIsModerator);

            if (userIsModerator) {
                fetchPendingSuggestionsCount();
                fetchPendingTimelineSuggestionsCount();
            }
            setError(null);
        } catch {
            setError('Error al cargar los detalles del tema');
        } finally {
            setLoading(false);
        }
    }, [topicId, fetchContentByTypePage, fetchPendingSuggestionsCount, fetchPendingTimelineSuggestionsCount, isAuthenticated, user?.id]);

    useEffect(() => {
        refreshTopicPageData();
    }, [refreshTopicPageData]);

    const handleSuggestionSuccess = () => {
        fetchPendingSuggestionsCount();
        refreshTopicPageData();
    };

    const creatorId = topic ? (typeof topic.creator === 'object' ? topic.creator.id : topic.creator) : null;
    const userId = user?.id;
    const isCreator = isAuthenticated && creatorId != null && userId != null && String(creatorId) === String(userId);
    const canEditTimeline = isCreator || isModerator;
    const canSuggestTimeline = isAuthenticated && !canEditTimeline;
    const showTimelineTab = canEditTimeline || timelineEntryCount > 0;

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'timeline' || tab === 'comments' || tab === 'content') {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const handleTabChange = (_, value) => {
        setActiveTab(value);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (value === 'content') {
                next.delete('tab');
            } else {
                next.set('tab', value);
            }
            return next;
        }, { replace: true });
    };

    useEffect(() => {
        if (loading) return;
        if (activeTab === 'timeline' && !showTimelineTab) {
            setActiveTab('content');
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('tab');
                return next;
            }, { replace: true });
        }
    }, [activeTab, showTimelineTab, loading, setSearchParams]);

    const loadMoreImages = useCallback(async () => {
        if (imagePageInfo.loading || !imagePageInfo.hasNext) {
            return false;
        }
        const nextPage = imagePageInfo.currentPage + 1;
        setImagePageInfo((prev) => ({ ...prev, loading: true }));
        try {
            const response = await fetchContentByTypePage('image', nextPage, TOPIC_IMAGE_PAGE_SIZE);
            const newImages = response.contents || response.results || [];
            if (newImages.length > 0) {
                setContentByType((prev) => ({
                    ...prev,
                    image: [...(prev.image || []), ...newImages],
                }));
            }
            setContentCounts((prev) => ({
                ...prev,
                image: response.count ?? prev.image ?? 0,
            }));
            setImagePageInfo({
                currentPage: response.current_page ?? nextPage,
                totalPages: response.total_pages ?? imagePageInfo.totalPages,
                hasNext: Boolean(response.has_next),
                loading: false,
            });
            return newImages.length > 0;
        } catch {
            setImagePageInfo((prev) => ({ ...prev, loading: false }));
            return false;
        }
    }, [fetchContentByTypePage, imagePageInfo]);

    const preloadRemainingImagesForCarousel = useCallback(async () => {
        if (imagePageInfo.loading || !imagePageInfo.hasNext) {
            return;
        }
        let currentPage = imagePageInfo.currentPage;
        let totalPages = imagePageInfo.totalPages;
        let hasNext = imagePageInfo.hasNext;
        setImagePageInfo((prev) => ({ ...prev, loading: true }));
        try {
            while (hasNext) {
                const response = await fetchContentByTypePage('image', currentPage + 1, TOPIC_IMAGE_PAGE_SIZE);
                const newImages = response.contents || response.results || [];
                if (newImages.length > 0) {
                    setContentByType((prev) => ({
                        ...prev,
                        image: [...(prev.image || []), ...newImages],
                    }));
                }
                setContentCounts((prev) => ({
                    ...prev,
                    image: response.count ?? prev.image ?? 0,
                }));
                currentPage = response.current_page ?? (currentPage + 1);
                totalPages = response.total_pages ?? totalPages;
                hasNext = Boolean(response.has_next);
            }
            setImagePageInfo({
                currentPage,
                totalPages,
                hasNext: false,
                loading: false,
            });
        } catch {
            setImagePageInfo((prev) => ({ ...prev, loading: false }));
        }
    }, [fetchContentByTypePage, imagePageInfo]);

    const renderContentSection = (type, contents, labels = {}) => {
        if (!contents || contents.length === 0) return null;

        const layout = labels.layout ?? 'grid';
        const displayContents = layout === 'imageGallery'
            ? contents.slice(0, isMobile ? 1 : 3)
            : contents.slice(0, 3);
        const totalForType = contentCounts[type] ?? contents.length;
        const hasMore = totalForType > displayContents.length;
        const sectionTitle = labels.sectionTitle ?? `${type}s`;
        const itemsWord = labels.itemsWord ?? `${type}s`;
        const seeAllPrefix = labels.seeAllPrefix ?? 'todos los';

        const sectionHeader = (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography
                    variant="h6"
                    sx={{
                        textTransform: layout === 'textList' || layout === 'imageGallery' ? 'none' : 'capitalize',
                        fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
                        fontWeight: 400,
                        fontSize: "18px",
                    }}
                    color="text.primary"
                >
                    {sectionTitle}
                </Typography>
                {hasMore && !labels.disableSeeAll && (
                    <Button
                        endIcon={<ArrowForwardIcon />}
                        onClick={() => navigate(`/content/topics/${topicId}/${type}`)}
                        sx={{ textTransform: 'none' }}
                    >
                        Ver {seeAllPrefix} {totalForType} {itemsWord}
                    </Button>
                )}
            </Box>
        );

        if (layout === 'textList') {
            return (
                <Box sx={{ mb: 4 }}>
                    {sectionHeader}
                    <Box
                        sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            px: 2,
                            py: 0.5,
                        }}
                    >
                        {displayContents.map((content) => {
                            const profile = content.selected_profile || content;
                            const titleText = profile.title || content.original_title || 'Sin título';
                            const authorName = profile.author || content.original_author;
                            const contentData = content.content || content;
                            const contentId = contentData.id;
                            const rowKey = content.id ?? contentId;

                            return (
                                <Box
                                    key={rowKey}
                                    sx={{
                                        display: 'flex',
                                        flexDirection: { xs: 'column', sm: 'row' },
                                        alignItems: { xs: 'flex-start', sm: 'center' },
                                        justifyContent: 'space-between',
                                        gap: 1.5,
                                        py: 2.5,
                                        borderBottom: '1px solid',
                                        borderColor: 'divider',
                                        '&:last-child': { borderBottom: 'none' },
                                    }}
                                >
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Link
                                            component={RouterLink}
                                            to={`/content/${contentId}/topic/${topicId}`}
                                            underline="always"
                                            color="primary"
                                            sx={{
                                                fontSize: '1rem',
                                                fontWeight: 500,
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            {titleText}
                                        </Link>
                                        {authorName && (
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{ mt: 0.5, fontSize: '0.875rem' }}
                                            >
                                                {authorName}
                                            </Typography>
                                        )}
                                    </Box>
                                    {contentData.vote_count !== undefined && topicId && (
                                        <Box
                                            sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', sm: 'center' } }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <VoteComponent
                                                type="content"
                                                ids={{ topicId, contentId }}
                                                initialVoteCount={contentData.vote_count ?? 0}
                                                initialUserVote={contentData.user_vote ?? 0}
                                            />
                                        </Box>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            );
        }

        if (layout === 'imageGallery') {
            return (
                <Box sx={{ mb: 4 }}>
                    {sectionHeader}
                    <Box
                        sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            p: 2,
                        }}
                    >
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: 'repeat(1, minmax(0, 1fr))',
                                    sm: 'repeat(3, minmax(0, 1fr))',
                                },
                                gap: 2,
                            }}
                        >
                            {displayContents.map((content, thumbIndex) => {
                                const profile = content.selected_profile || content;
                                const titleText = profile.title || content.original_title || 'Sin título';
                                const contentData = content.content || content;
                                const contentId = contentData.id;
                                const rowKey = content.id ?? contentId;
                                const src = getGalleryImageSrc(content);

                                return (
                                    <Box
                                        key={rowKey}
                                        sx={{
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            bgcolor: 'background.paper',
                                            overflow: 'hidden',
                                            display: 'flex',
                                            flexDirection: 'column',
                                        }}
                                    >
                                        <TopicGalleryThumb
                                            src={src}
                                            titleText={titleText}
                                            onOpen={() => labels.onImageGalleryOpen?.(thumbIndex)}
                                        />
                                        <Box sx={{ px: 1, pt: 0.75, minWidth: 0 }}>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                noWrap
                                                title={titleText}
                                                sx={{ display: 'block' }}
                                            >
                                                {titleText}
                                            </Typography>
                                        </Box>
                                        {contentData.vote_count !== undefined && topicId && (
                                            <Box
                                                sx={{
                                                    px: 0.5,
                                                    pb: 0.5,
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <VoteComponent
                                                    type="content"
                                                    ids={{ topicId, contentId }}
                                                    initialVoteCount={contentData.vote_count ?? 0}
                                                    initialUserVote={contentData.user_vote ?? 0}
                                                />
                                            </Box>
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                </Box>
            );
        }

        return (
            <Box sx={{ mb: 4 }}>
                {sectionHeader}

                <Grid container spacing={3}>
                    {displayContents.map((content) => (
                        <Grid item xs={12} sm={6} md={4} key={content.id}>
                            <ContentDisplay
                                content={content}
                                variant="card"
                                showAuthor={true}
                                showTitle={type !== 'image'}
                                topicId={topicId}
                                onClick={() => navigate(`/content/${content.id}/topic/${topicId}`)}
                            />
                        </Grid>
                    ))}
                </Grid>
            </Box>
        );
    };

    if (loading) return <Typography>Cargando detalles del tema...</Typography>;
    if (error) return <Typography color="error">{error}</Typography>;
    if (!topic) return <Typography>Tema no encontrado</Typography>;

    const totalPendingSuggestions = pendingSuggestionsCount
        + pendingTimelineSuggestionsCount
        + pendingTimelineEntryContentSuggestionsCount;

    return (
        <Box sx={{ pt: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
            <TopicHeader 
                topic={topic}
                canEdit={canEditTimeline}
                pendingSuggestionsCount={totalPendingSuggestions}
                onEdit={() => navigate(
                    `/content/topics/${topicId}/edit${totalPendingSuggestions > 0 ? '?tab=suggestions' : ''}`,
                )}
            />

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                {!canEditTimeline && isAuthenticated && (
                    <>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setSuggestionModalOpen(true)}
                        >
                            Sugerir Contenido
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<ListIcon />}
                            onClick={() => navigate(`/content/topics/${topicId}/suggestions`)}
                        >
                            Ver sugerencias del tema
                        </Button>
                    </>
                )}
            </Box>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    variant="scrollable"
                    allowScrollButtonsMobile
                >
                    <Tab value="content" label="Contenido" />
                    {showTimelineTab && <Tab value="timeline" label="Linea de tiempo" />}
                    <Tab value="comments" label="Comentarios" />
                </Tabs>
            </Box>

            {activeTab === 'content' && (
                <>
                    {/* Content sections: imágenes en galería; video/audio en tarjetas; textos en lista */}
                    {renderContentSection('image', contentByType.image, {
                        sectionTitle: 'Imágenes',
                        itemsWord: 'imágenes',
                        seeAllPrefix: 'todas las',
                        layout: 'imageGallery',
                        onImageGalleryOpen: (idx) => {
                            setImageLightboxIndex(idx);
                            setImageLightboxOpen(true);
                            preloadRemainingImagesForCarousel();
                        },
                    })}

                    <TopicImageLightbox
                        open={imageLightboxOpen}
                        onClose={() => setImageLightboxOpen(false)}
                        items={contentByType.image || []}
                        index={imageLightboxIndex}
                        onIndexChange={setImageLightboxIndex}
                        topicId={topicId}
                        navigate={navigate}
                        hasNextPage={imagePageInfo.hasNext}
                        onRequestNextPage={loadMoreImages}
                        isLoadingNextPage={imagePageInfo.loading}
                    />
                    {renderContentSection('video', contentByType.video)}
                    {renderContentSection('audio', contentByType.audio)}
                    {renderContentSection('text', contentByType.text, {
                        sectionTitle: 'Textos',
                        itemsWord: 'textos',
                        layout: 'textList',
                    })}

                    {(Object.values(contentCounts).reduce((acc, n) => acc + (n || 0), 0) === 0) && (
                        <Typography variant="body1" color="text.secondary" align="center">
                            Aún no se ha agregado contenido a este tema.
                        </Typography>
                    )}
                </>
            )}

            {activeTab === 'timeline' && (
                <TopicTimeline
                    topicId={topicId}
                    canEdit={canEditTimeline}
                    canSuggest={canSuggestTimeline}
                />
            )}

            {activeTab === 'comments' && (
                <CommentSection topicId={topicId} />
            )}

            {/* Content Suggestion Modal */}
            <ContentSuggestionModal
                open={suggestionModalOpen}
                onClose={() => setSuggestionModalOpen(false)}
                topicId={topicId}
                onSuccess={handleSuggestionSuccess}
            />
        </Box>
    );
};

export default TopicDetail; 