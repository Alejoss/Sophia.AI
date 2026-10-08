import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { getTopicContentPath, getTopicDetailPath, normalizeTopicTab, TOPIC_TABS } from '../utils/urlUtils';
import { 
    Box, 
    Typography, 
    Button,
    Paper,
    Skeleton,
    Snackbar,
    Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ShareIcon from '@mui/icons-material/Share';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';
import CommentSection from '../comments/CommentSection';
import VoteComponent from '../votes/VoteComponent';
import BookmarkButton from '../bookmarks/BookmarkButton';
import ContentDisplay from './ContentDisplay';
import ContentTranscriptLink from './ContentTranscriptLink';
import AddToLibraryModal from '../components/AddToLibraryModal';
import TopicHeader from '../topics/TopicHeader';
import { AuthContext } from '../context/AuthContext';

// ContentDisplay Mode: "preview" - Basic preview for topic content detail
const ContentDetailsTopic = () => {
    const { t } = useTranslation('content');
    const { contentId, topicId } = useParams();
    const { authState } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [content, setContent] = useState(null);
    const [topic, setTopic] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success',
    });

    useEffect(() => {
        const fetchContentAndTopic = async () => {
            try {
                const [contentData, topicData] = await Promise.all([
                    contentApi.getContentDetails(contentId, 'topic', topicId),
                    contentApi.getTopicDetails(topicId)
                ]);
                
                setContent(contentData);
                setTopic(topicData);
                setLoading(false);
            } catch (err) {
                console.error('ContentDetailsTopic: Error fetching data:', err);
                console.error('ContentDetailsTopic: Error details:', {
                    message: err.message,
                    status: err.response?.status,
                    data: err.response?.data
                });
                setError(t('detailsTopic.loadError'));
                setLoading(false);
            }
        };

        fetchContentAndTopic();
    }, [contentId, topicId, t]);

    const showSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleCloseSnackbar = (_, reason) => {
        if (reason === 'clickaway') return;
        setSnackbar((prev) => ({ ...prev, open: false }));
    };

    const handleShareContent = async () => {
        const shareUrl = `${window.location.origin}${getTopicContentPath(contentId, topicId)}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            showSnackbar(t('detailsTopic.urlCopied'), 'success');
        } catch (err) {
            console.error('Failed to copy content URL:', err);
            try {
                const textArea = document.createElement('textarea');
                textArea.value = shareUrl;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                showSnackbar(t('detailsTopic.urlCopied'), 'success');
            } catch (fallbackErr) {
                console.error('Fallback copy failed:', fallbackErr);
                showSnackbar(t('detailsTopic.urlCopyError'), 'error');
            }
        }
    };

    const handleAddToLibrarySuccess = () => {
        // Refresh content data after adding to library
        contentApi.getContentDetails(contentId, 'topic', topicId)
            .then(updatedContent => {
                setContent(updatedContent);
            })
            .catch(err => {
                console.error('Error refreshing content:', err);
            });
    };

    if (loading) {
        return (
            <Box sx={{ pt: 4, px: 3, maxWidth: 1200, mx: 'auto' }}>
                <Skeleton variant="rounded" height={120} sx={{ mb: 2 }} />
                <Skeleton variant="rounded" width={280} height={36} sx={{ mb: 2 }} />
                <Paper sx={{ p: 3 }}>
                    <Skeleton variant="text" width="60%" height={40} sx={{ mb: 2 }} />
                    <Skeleton variant="rounded" width="100%" height={240} />
                </Paper>
            </Box>
        );
    }
    if (error) return <Typography color="error">{error}</Typography>;
    if (!content || !topic) return <Typography>{t('detailsTopic.notFound')}</Typography>;

    const profileUserId = content?.selected_profile?.user;
    const currentUserId = authState.user?.id;
    const isOwnContent = profileUserId && currentUserId && parseInt(profileUserId) === parseInt(currentUserId);

    const mediaTypeRaw = content.media_type || content.content?.media_type || '';
    const mediaType = String(mediaTypeRaw).toLowerCase();
    const mediaTypeLabels = {
        image: t('detailsTopic.allImages'),
        video: t('detailsTopic.allVideos'),
        text: t('detailsTopic.allTexts'),
        audio: t('detailsTopic.allAudio'),
    };
    const allOfTypeLabel = mediaTypeLabels[mediaType] || t('detailsTopic.allOfType', { type: mediaType });
    const returnTab = normalizeTopicTab(searchParams.get('tab'));
    const backPath = returnTab !== TOPIC_TABS.CONTENT
        ? getTopicDetailPath(topicId, returnTab)
        : mediaType
            ? `/content/topics/${topicId}/${mediaType}`
            : getTopicDetailPath(topicId);
    const backLabelsByTab = {
        [TOPIC_TABS.TIMELINE]: t('detailsTopic.backTimeline'),
        [TOPIC_TABS.COMMENTS]: t('detailsTopic.backComments'),
    };
    const backLabel = returnTab !== TOPIC_TABS.CONTENT
        ? (backLabelsByTab[returnTab] || t('detailsTopic.backTopic'))
        : mediaType
            ? allOfTypeLabel
            : t('detailsTopic.backMain');

    return (
        <Box sx={{ pt: 4, px: 3, maxWidth: 1200, mx: 'auto' }}>
            <TopicHeader 
                topic={topic}
                onEdit={() => navigate(`/content/topics/${topicId}/edit`)}
                size="small"
            />

            <Box sx={{ mb: 2 }}>
                <Button
                    component={Link}
                    to={backPath}
                    startIcon={<ArrowBackIcon />}
                    sx={{ mb: 2, textTransform: 'none' }}
                >
                    {backLabel}
                </Button>
            </Box>

            <Paper sx={{ p: 3, mb: 4 }}>
                {/* Action Buttons */}
                <Box sx={{ 
                    display: 'flex', 
                    gap: 2, 
                    mb: 3,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    '& .MuiButton-root': {
                        color: 'primary.main',
                        borderColor: 'primary.main',
                        '&:hover': {
                            borderColor: 'primary.dark',
                            backgroundColor: 'primary.light',
                            color: 'primary.dark'
                        }
                    },
                    '& .MuiIconButton-root': {
                        color: 'primary.main',
                        '&:hover': {
                            backgroundColor: 'primary.light'
                        }
                    }
                }}>
                    {authState.isAuthenticated && !isOwnContent && (
                        <AddToLibraryModal
                            content={content}
                            onSuccess={handleAddToLibrarySuccess}
                        />
                    )}
                    {authState.isAuthenticated && (
                        <BookmarkButton
                            type="content"
                            ids={{
                                topicId: topicId,
                                contentId: contentId
                            }}
                            initialIsBookmarked={content.is_bookmarked}
                        />
                    )}
                    <VoteComponent
                        type="content"
                        ids={{
                            topicId: topicId,
                            contentId: contentId
                        }}
                        initialVoteCount={content.vote_count || 0}
                        initialUserVote={content.user_vote || 0}
                    />
                    <Button
                        variant="outlined"
                        startIcon={<ShareIcon />}
                        onClick={handleShareContent}
                        sx={{ textTransform: 'none' }}
                    >
                        {t('actions.share')}
                    </Button>
                </Box>

                {/* Content Display */}
                <ContentDisplay 
                    content={content}
                    variant="preview"
                />

                <ContentTranscriptLink
                    contentId={contentId}
                    context="topic"
                    topicId={topicId}
                />
            </Paper>

            <CommentSection topicId={topicId} />

            <Snackbar
                open={snackbar.open}
                autoHideDuration={2500}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleCloseSnackbar}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default ContentDetailsTopic;
