import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';
import LibrarySelectMultiple from '../content/LibrarySelectMultiple';
import UploadContentForm from '../content/UploadContentForm';

const TopicContentManager = ({ topicId, topicTitle: topicTitleProp = '' }) => {
  const { t } = useTranslation('topics');
  const [topicData, setTopicData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showAddContent, setShowAddContent] = useState(false);
  const [addSourceMode, setAddSourceMode] = useState(null);
  const [uploadMode, setUploadMode] = useState('file');

  const topicTitle = topicTitleProp || topicData?.topic?.title || '';

  const refreshContent = useCallback(async () => {
    const data = await contentApi.getTopicDetailsSimple(topicId);
    setTopicData(data);
    return data;
  }, [topicId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await refreshContent();
        if (!cancelled) {
          setTopicData(data);
          setError(null);
        }
      } catch {
        if (!cancelled) setError(t('addContent.loadContentError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [refreshContent, t]);

  const handleContentRemove = async (contentId) => {
    try {
      setSaving(true);
      await contentApi.removeContentFromTopic(topicId, [contentId]);
      await refreshContent();
    } catch {
      setError(t('addContent.removeError'));
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
      await refreshContent();
      setSuccessMessage(t('addContent.success'));
      setAddSourceMode(null);
      setShowAddContent(false);
    } catch {
      setError(t('addContent.addTheError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdd = async (selectedContentProfileIds) => {
    try {
      setSaving(true);
      await contentApi.addContentToTopic(topicId, selectedContentProfileIds);
      await refreshContent();
      setSuccessMessage(t('addContent.success'));
      setAddSourceMode(null);
      setShowAddContent(false);
    } catch {
      setError(t('addContent.addError'));
    } finally {
      setSaving(false);
    }
  };

  const filterContent = (content) => {
    const isInTopic = content?.content?.topics?.some(
      (id) => id === parseInt(topicId, 10),
    );
    return !isInTopic;
  };

  if (loading) {
    return <Typography color="text.secondary">{t('media.loading')}</Typography>;
  }
  if (error && !topicData) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (!topicData) {
    return <Alert severity="error">{t('detail.notFound')}</Alert>;
  }

  if (showAddContent) {
    if (addSourceMode === 'library') {
      return (
        <Box>
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => setAddSourceMode(null)}
            sx={{ mb: 2, textTransform: 'none' }}
            disabled={saving}
          >
            {t('common.back')}
          </Button>
          <LibrarySelectMultiple
            title={topicTitle ? t('addContent.shortTitle', { title: topicTitle }) : t('addContent.shortTitlePlain')}
            description={t('addContent.libraryDescription')}
            onCancel={() => setAddSourceMode(null)}
            onSave={handleSaveAdd}
            filterFunction={filterContent}
            contextName={topicTitle}
          />
        </Box>
      );
    }

    if (addSourceMode === 'upload') {
      return (
        <Box>
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => setAddSourceMode(null)}
            sx={{ mb: 2, textTransform: 'none' }}
            disabled={saving}
          >
            {t('common.back')}
          </Button>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {uploadMode === 'url' ? t('addContent.fromUrlHelp') : t('suggestion.uploadFile')}
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
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {t('addContent.pageTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('addContent.choiceHelp')}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button variant="contained" onClick={() => setAddSourceMode('library')} sx={{ textTransform: 'none', py: 1.5 }}>
            {t('suggestion.chooseLibrary')}
          </Button>
          <Button variant="outlined" onClick={() => { setUploadMode('url'); setAddSourceMode('upload'); }} sx={{ textTransform: 'none', py: 1.5 }}>
            {t('suggestion.fromUrl')}
          </Button>
          <Button variant="outlined" onClick={() => { setUploadMode('file'); setAddSourceMode('upload'); }} sx={{ textTransform: 'none', py: 1.5 }}>
            {t('suggestion.uploadFile')}
          </Button>
        </Box>
        <Button variant="text" onClick={() => setShowAddContent(false)} sx={{ mt: 2, textTransform: 'none' }}>
          {t('common.cancel')}
        </Button>
      </Paper>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {t('addContent.inTopicCount', { count: topicData.contents?.length || 0 })}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowAddContent(true)}
          sx={{ textTransform: 'none' }}
        >
          {t('addContent.shortTitlePlain')}
        </Button>
      </Box>

      {topicData.description && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {topicData.description}
          </Typography>
          <Divider sx={{ mb: 2 }} />
        </>
      )}

      {(topicData.contents?.length || 0) === 0 ? (
        <Alert severity="info">{t('addContent.emptyInTopic')}</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('edit.titleLabel')}</TableCell>
                <TableCell>{t('common.type')}</TableCell>
                <TableCell>{t('addContent.author')}</TableCell>
                <TableCell>{t('common.view')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {topicData.contents.map((contentProfile) => (
                <TableRow key={contentProfile.id} hover>
                  <TableCell>{contentProfile.title || t('common.untitledPlain')}</TableCell>
                  <TableCell>
                    <Chip label={contentProfile.content?.media_type} size="small" color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell>{contentProfile.author || t('addContent.unknownAuthor')}</TableCell>
                  <TableCell>
                    <Button
                      component="a"
                      href={`/content/${contentProfile.content.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      endIcon={<OpenInNewIcon />}
                      sx={{ textTransform: 'none' }}
                    >
                      {t('common.view')}
                    </Button>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => handleContentRemove(contentProfile.content.id)}
                      disabled={saving}
                      sx={{ textTransform: 'none' }}
                    >
                      {t('common.delete')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

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

export default TopicContentManager;
