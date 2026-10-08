import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    Box,
    Typography,
    Paper,
    Button,
    Snackbar,
    Alert,
    Link as MuiLink,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import { useTranslation } from 'react-i18next';
import LibrarySelectMultiple from '../content/LibrarySelectMultiple';
import UploadContentForm from '../content/UploadContentForm';
import contentApi from '../api/contentApi';

const TopicAddContent = () => {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation('topics');
    const [topicData, setTopicData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);
    const [selectedContentProfileIds, setSelectedContentProfileIds] = useState([]);
    const [addSourceMode, setAddSourceMode] = useState(null); // null | 'library' | 'upload'
    const [uploadMode, setUploadMode] = useState('file'); // 'url' | 'file'

    const topicTitle = topicData?.topic?.title ?? '';

    useEffect(() => {
        const fetchTopic = async () => {
            try {
                const data = await contentApi.getTopicDetailsSimple(topicId);
                setTopicData(data);
            } catch (err) {
                setError(t('addContent.loadTopicError'));
            } finally {
                setLoading(false);
            }
        };
        fetchTopic();
    }, [topicId, t]);

    const goToTopicView = () => {
        navigate(`/content/topics/${topicId}`);
    };

    const handleBackToSourceChoice = () => {
        setAddSourceMode(null);
    };

    const handleSave = async (selectedIds) => {
        try {
            setSaving(true);
            await contentApi.addContentToTopic(topicId, selectedIds);
            setSuccessMessage(t('addContent.success'));
            setAddSourceMode(null);
        } catch (err) {
            console.error('TopicAddContent - Failed to add content to topic:', err);
            setError(t('addContent.addError'));
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const handleContentUploaded = async (contentProfile) => {
        const profileId = contentProfile?.id ?? contentProfile;
        if (!profileId) return;
        try {
            setSaving(true);
            await contentApi.addContentToTopic(topicId, [profileId]);
            setSuccessMessage(t('addContent.success'));
            setAddSourceMode(null);
        } catch (err) {
            console.error('Failed to add uploaded content to topic:', err);
            setError(t('addContent.addTheError'));
        } finally {
            setSaving(false);
        }
    };

    const handleSelectionChange = (selectedContentProfiles) => {
        setSelectedContentProfileIds(selectedContentProfiles.map((p) => p.id));
    };

    const filterContent = (content) => {
        const isInTopic = content?.content?.topics?.some(
            (tid) => tid === parseInt(topicId, 10)
        );
        return !isInTopic;
    };

    if (loading) {
        return <Typography>{t('common.loading')}</Typography>;
    }
    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography color="error">{error}</Typography>
                <Button onClick={goToTopicView} sx={{ textTransform: 'none', mt: 2 }}>
                    {t('edit.backToTopic')}
                </Button>
            </Box>
        );
    }

    if (addSourceMode === 'library') {
        return (
            <Box sx={{ pt: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: 900, mx: 'auto' }}>
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                        variant="text"
                        startIcon={<ArrowBackIcon />}
                        onClick={handleBackToSourceChoice}
                        sx={{ textTransform: 'none' }}
                        disabled={saving}
                    >
                        {t('common.back')}
                    </Button>
                </Box>
                <LibrarySelectMultiple
                    title={topicTitle ? t('addContent.libraryTitle', { title: topicTitle }) : t('addContent.pageTitle')}
                    description={t('addContent.libraryDescription')}
                    onCancel={handleBackToSourceChoice}
                    onSave={handleSave}
                    onSelectionChange={handleSelectionChange}
                    filterFunction={filterContent}
                    contextName={topicTitle || topicId}
                    selectedIds={selectedContentProfileIds}
                />
            </Box>
        );
    }

    if (addSourceMode === 'upload') {
        return (
            <Box sx={{ pt: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: 800, mx: 'auto' }}>
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                        variant="text"
                        startIcon={<ArrowBackIcon />}
                        onClick={handleBackToSourceChoice}
                        sx={{ textTransform: 'none' }}
                        disabled={saving}
                    >
                        {t('common.back')}
                    </Button>
                </Box>
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 1 }}>
                        {topicTitle ? t('addContent.libraryTitle', { title: topicTitle }) : t('addContent.pageTitle')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {uploadMode === 'url'
                            ? t('addContent.fromUrlHelp')
                            : t('suggestion.uploadFile')}
                    </Typography>
                    <UploadContentForm
                        onContentUploaded={handleContentUploaded}
                        onUploadingChange={setSaving}
                        initialUrlMode={uploadMode === 'url'}
                        showModeToggle={false}
                    />
                </Paper>
            </Box>
        );
    }

    return (
        <Box sx={{ pt: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: 600, mx: 'auto' }}>
            <Paper elevation={2} sx={{ p: 4 }}>
                <Typography
                    variant="h6"
                    gutterBottom
                    sx={{
                        mb: 0.5,
                        fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
                        fontWeight: 500,
                        fontSize: '1.25rem',
                    }}
                >
                    {t('addContent.pageTitle')}
                </Typography>
                {topicTitle && (
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        <MuiLink
                            component={Link}
                            to={`/content/topics/${topicId}`}
                            sx={{
                                color: 'primary.main',
                                textDecoration: 'underline',
                                fontWeight: 500,
                                '&:hover': { textDecoration: 'underline' },
                            }}
                        >
                            {topicTitle}
                        </MuiLink>
                    </Typography>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {t('addContent.choiceHelp')}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button
                        variant="contained"
                        color="primary"
                        size="large"
                        onClick={() => setAddSourceMode('library')}
                        sx={{ textTransform: 'none', py: 2 }}
                    >
                        {t('suggestion.chooseLibrary')}
                    </Button>
                    <Button
                        variant="outlined"
                        size="large"
                        onClick={() => { setUploadMode('url'); setAddSourceMode('upload'); }}
                        sx={{ textTransform: 'none', py: 2 }}
                    >
                        {t('suggestion.fromUrl')}
                    </Button>
                    <Button
                        variant="outlined"
                        size="large"
                        onClick={() => { setUploadMode('file'); setAddSourceMode('upload'); }}
                        sx={{ textTransform: 'none', py: 2 }}
                    >
                        {t('suggestion.uploadFile')}
                    </Button>
                </Box>
                <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button
                        variant="outlined"
                        onClick={goToTopicView}
                        sx={{ width: '100%', textTransform: 'none' }}
                    >
                        {t('edit.backToTopic')}
                    </Button>
                    <Button
                        component={Link}
                        to={`/content/topics/${topicId}/edit?tab=content`}
                        variant="text"
                        size="small"
                        startIcon={<EditIcon />}
                        sx={{ textTransform: 'none', alignSelf: 'center' }}
                    >
                        {t('addContent.editTopicContent')}
                    </Button>
                </Box>
            </Paper>
            <Snackbar
                open={Boolean(successMessage)}
                autoHideDuration={4000}
                onClose={() => setSuccessMessage(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSuccessMessage(null)} severity="success" variant="filled">
                    {successMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default TopicAddContent;
