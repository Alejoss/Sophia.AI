import React, { useState, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import axiosInstance from '../api/axiosConfig';
import contentApi from '../api/contentApi';
import { inferTitleAuthorFromFileName, suggestEntryTitleFromFileName } from './inferTitleAuthorFromFileName';
import {
  Grid,
  FormControlLabel,
  Switch,
  Checkbox,
  Typography,
  Paper,
  Button,
  Box,
  TextField,
  Alert,
  FormControl,
  InputLabel,
  FormHelperText,
  CircularProgress,
  LinearProgress,
  Card,
  CardMedia,
  CardContent,
  Avatar,
  Skeleton,
  Select,
  MenuItem,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  Snackbar,
  Collapse,
  Chip } from
'@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useTranslation } from 'react-i18next';
import { getMediaType } from './mediaTypeFromFile';
import i18n from '../i18n';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';
import { bindMuiRhfField } from '../utils/muiRhfField';

// URL Preview Component
const URLPreview = ({ previewData, isLoading, error }) => {
  const { t } = useTranslation('content');
  if (isLoading) {
    return (
      <Card sx={{ mt: 2, mb: 3, display: 'flex', alignItems: 'start', position: 'relative', zIndex: 1 }}>
        <Skeleton variant="rectangular" width={140} height={140} />
        <CardContent sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Skeleton variant="circular" width={20} height={20} sx={{ mr: 1 }} />
            <Skeleton variant="text" width={100} />
          </Box>
          <Skeleton variant="text" sx={{ fontSize: '1.25rem' }} />
          <Skeleton variant="text" />
          <Skeleton variant="text" />
        </CardContent>
      </Card>);

  }

  if (error) {
    return (
      <Alert severity="warning" sx={{ mt: 2, mb: 3, position: 'relative', zIndex: 1 }}>
        {error}
      </Alert>);

  }

  if (!previewData) return null;

  const isYouTube = previewData.siteName === 'YouTube' && previewData.type === 'video';

  return (
    <Card sx={{
      mt: 2,
      mb: 3,
      display: 'flex',
      alignItems: 'start',
      position: 'relative',
      zIndex: 1,
      boxShadow: 2,
      '&:hover': {
        boxShadow: 3
      }
    }}>
      {previewData.image &&
      <Box sx={{ position: 'relative', width: 140, minWidth: 140, height: 140 }}>
          <CardMedia
          component="img"
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          image={previewData.image}
          alt={previewData.title || t('upload.previewAlt')} />
        
          {isYouTube &&
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 48,
            height: 48,
            bgcolor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
          
              <Box
            sx={{
              width: 0,
              height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderLeft: '16px solid white',
              marginLeft: '4px'
            }} />
          
            </Box>
        }
        </Box>
      }
      <CardContent sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {previewData.favicon &&
          <Avatar
            src={previewData.favicon}
            sx={{ width: 20, height: 20, mr: 1 }} />

          }
          {previewData.siteName &&
          <Typography variant="caption" color="text.secondary" noWrap>
              {previewData.siteName}
            </Typography>
          }
        </Box>
        {previewData.title &&
        <Typography variant="subtitle1" component="div" gutterBottom noWrap>
            {previewData.title}
          </Typography>
        }
        {previewData.description &&
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
          
            {previewData.description}
          </Typography>
        }
      </CardContent>
    </Card>);

};

// Create schema function that can access current form values
const createSchema = () => yup.object({
  file: yup.mixed().when('isUrlMode', {
    is: false,
    then: () => yup.mixed().required(() => i18n.t('content:upload.fileRequired')),
    otherwise: () => yup.mixed().nullable()
  }),
  url: yup.string().when('isUrlMode', {
    is: true,
    then: () => yup.string().
    required(() => i18n.t('content:upload.urlRequired')).
    test('is-url', () => i18n.t('content:upload.urlInvalid'), function (value) {
      if (!value) return true; // required check handles empty
      // Normalize URL by adding https:// if missing
      const normalized = value.match(/^https?:\/\//i) ? value : `https://${value}`;
      // Use yup's url validation on normalized URL
      return yup.string().url().isValidSync(normalized);
    }),
    otherwise: () => yup.string().nullable()
  }),
  media_type: yup.string().when('isUrlMode', {
    is: true,
    then: () => yup.string().oneOf(['VIDEO', 'AUDIO', 'TEXT', 'IMAGE'], () => i18n.t('content:upload.mediaTypeInvalid')).required(() => i18n.t('content:upload.mediaTypeRequired')),
    otherwise: () => yup.string().nullable()
  }),
  title: yup.string().max(255, () => i18n.t('content:upload.titleMax')),
  author: yup.string().max(255, () => i18n.t('content:upload.authorMax')),
  has_spanish_subtitles: yup.boolean(),
  has_spanish_dubbing: yup.boolean(),
  is_producer: yup.boolean(),
  is_visible: yup.boolean(),
  isUrlMode: yup.boolean()
}).required();

const schema = createSchema();

const UploadContentForm = ({ onContentUploaded, onFileSelected, initialData = null, isEditMode = false, contentId = null, contentProfileId = null, onUploadingChange, initialUrlMode = null, showModeToggle = true, onHasPendingContentChange }) => {
  const { t } = useTranslation('content');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // 0-100 for file uploads, null when not uploading or URL mode
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [generalError, setGeneralError] = useState('');
  const [hasSavedSuccessfully, setHasSavedSuccessfully] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  // Notify parent when uploading state changes; clear on unmount so parents
  // do not keep a stuck "uploading" / disabled state after this form closes.
  useEffect(() => {
    if (onUploadingChange) {
      onUploadingChange(isUploading);
    }
    return () => {
      if (onUploadingChange) {
        onUploadingChange(false);
      }
    };
  }, [isUploading, onUploadingChange]);
  const [isUrlMode, setIsUrlMode] = useState(initialUrlMode !== null ? initialUrlMode : !!initialData?.url);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const fileInputRef = React.useRef(null);
  const [titleAuthorExpanded, setTitleAuthorExpanded] = useState(false);

  const mediaTypeLabel = (code) => t(`mediaType.${code}`, { defaultValue: code });

  // Determine initial isUrlMode value
  const initialIsUrlMode = initialUrlMode !== null ? initialUrlMode : !!initialData?.url;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
    setError,
    trigger
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      title: initialData?.title || '',
      author: initialData?.author || '',
      has_spanish_subtitles: initialData?.has_spanish_subtitles || false,
      has_spanish_dubbing: initialData?.has_spanish_dubbing || false,
      is_producer: false,
      is_visible: true,
      isUrlMode: initialIsUrlMode,
      media_type: initialData?.media_type || '',
      url: initialData?.url || ''
    }
  });

  const titleValue = watch('title');
  const authorValue = watch('author');
  // Watch the URL and file fields for changes
  const url = watch('url');
  const file = watch('file');
  const urlField = bindMuiRhfField(register('url'), url);
  const authorField = bindMuiRhfField(register('author'), authorValue);
  const titleField = bindMuiRhfField(register('title'), titleValue);

  // Sync isUrlMode state with form value when initialUrlMode changes
  useEffect(() => {
    if (initialUrlMode !== null && initialUrlMode !== isUrlMode) {
      setIsUrlMode(initialUrlMode);
      setValue('isUrlMode', initialUrlMode, { shouldValidate: false });
    }
  }, [initialUrlMode]); // Only depend on initialUrlMode to avoid unnecessary runs

  // Always keep form isUrlMode in sync with state (only when state changes)
  useEffect(() => {
    setValue('isUrlMode', isUrlMode, { shouldValidate: false });
  }, [isUrlMode, setValue]);

  const applyMetadataFromFileName = (filename) => {
    if (!filename) return;
    const suggestedTitle = suggestEntryTitleFromFileName(filename);
    const { author } = inferTitleAuthorFromFileName(filename);
    if (suggestedTitle) {
      setValue('title', suggestedTitle, { shouldValidate: true });
    }
    if (author) {
      setValue('author', author, { shouldValidate: true });
    }
  };

  const handleFilePicked = (selectedFile) => {
    if (!selectedFile) return;
    applyMetadataFromFileName(selectedFile.name);
    if (onFileSelected) onFileSelected(selectedFile);
  };

  useEffect(() => {
    if (isUrlMode || isEditMode) return;
    const selected = file?.[0];
    if (selected?.name) {
      applyMetadataFromFileName(selected.name);
    }
  }, [file, isUrlMode, isEditMode]);

  // Notify parent when user has pending content (URL or file filled but not yet saved)
  useEffect(() => {
    if (typeof onHasPendingContentChange !== 'function') return;
    const hasPending = !hasSavedSuccessfully && (
    isUrlMode && url && String(url).trim() !== '' ||
    !isUrlMode && file && file[0]);

    onHasPendingContentChange(!!hasPending);
  }, [hasSavedSuccessfully, isUrlMode, url, file, onHasPendingContentChange]);

  // Auto-set media type to VIDEO when URL is YouTube (immediate, no debounce)
  useEffect(() => {
    if (!isUrlMode || !url || typeof url !== 'string') return;
    const trimmed = url.trim();
    const withProtocol = trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`;
    if (withProtocol.includes('youtube.com') || withProtocol.includes('youtu.be')) {
      setValue('media_type', 'VIDEO');
    }
  }, [isUrlMode, url, setValue]);

  // Initialize form with initialData when in edit mode
  useEffect(() => {
    if (isEditMode && initialData) {

      const isUrlContent = !!initialData.url;


      setIsUrlMode(isUrlContent);
      setValue('isUrlMode', isUrlContent);

      // Set form values
      setValue('title', initialData.title || '');
      setValue('author', initialData.author || '');
      setValue('media_type', initialData.media_type || '');
      setValue('url', initialData.url || '');
      setValue('has_spanish_subtitles', initialData.has_spanish_subtitles || false);
      setValue('has_spanish_dubbing', initialData.has_spanish_dubbing || false);


      // If it's URL content, fetch preview
      if (isUrlContent && initialData.url) {
        contentApi.fetchUrlMetadata(initialData.url).
        then((metadata) => {
          setPreviewData(metadata);
        }).
        catch((error) => {
          console.error('Failed to fetch initial preview:', error);
        });
      }
    }
  }, [isEditMode, initialData, setValue]);

  // Effect to fetch preview when URL changes
  useEffect(() => {
    if (!isUrlMode || !url) {

      setPreviewData(null);
      setPreviewError(null); // Clear error when URL is cleared
      return;
    }


    setPreviewError(null); // Clear error when URL changes

    // Helper function to normalize URL (add protocol if missing)
    const normalizeUrl = (urlString) => {
      if (!urlString || urlString.trim() === '') return null;
      const trimmed = urlString.trim();
      // If URL doesn't start with http:// or https://, add https://
      if (!trimmed.match(/^https?:\/\//i)) {
        return `https://${trimmed}`;
      }
      return trimmed;
    };

    // Basic URL check - just check if it looks like a URL (has a dot or is a valid format)
    const looksLikeUrl = (urlString) => {
      if (!urlString || urlString.trim() === '') return false;
      const trimmed = urlString.trim();
      // Check if it has at least a dot and some characters (basic URL pattern)
      return trimmed.includes('.') && trimmed.length > 4;
    };

    const fetchPreview = async () => {
      // Check if URL looks valid before attempting fetch
      if (!looksLikeUrl(url)) {

        setPreviewError(null);
        return;
      }

      setIsLoadingPreview(true);
      setPreviewError(null);

      try {
        // Normalize URL before fetching
        const normalizedUrl = normalizeUrl(url);


        // Auto-detect YouTube and set media type to Video
        if (normalizedUrl && (normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be'))) {
          setValue('media_type', 'VIDEO');
        }

        const metadata = await contentApi.fetchUrlMetadata(normalizedUrl);

        setPreviewData(metadata);
        setPreviewError(null); // Clear any previous errors

        // Auto-fill form fields if empty
        const currentTitle = watch('title');
        if (!currentTitle && metadata.title) {

          setValue('title', metadata.title);
        }
      } catch (error) {
        console.error('Preview fetch error:', error);
        setPreviewData(null); // Clear any previous preview data
        // Only show error if URL is still the same (url is captured in closure)
        // Check current URL value to ensure it hasn't changed
        const currentUrl = watch('url');
        if (currentUrl === url) {
          setPreviewError(
            error?.response?.data?.error
            || error?.error
            || t('upload.previewError'),
          );
        }
      } finally {
        setIsLoadingPreview(false);
      }
    };

    fetchPreview();

    return undefined;
  }, [url, isUrlMode]); // Removed setValue, trigger, watch from dependencies to avoid unnecessary re-runs

  const onSubmit = async (data) => {
    setGeneralError('');

    // Use form data's isUrlMode if available, otherwise fall back to state
    const currentIsUrlMode = data.isUrlMode !== undefined ? data.isUrlMode : isUrlMode;


    setIsUploading(true);
    setUploadProgress(0);
    try {

      if (isEditMode && contentId) {
        // Edit mode - update existing content


        if (!currentIsUrlMode) {
          // File upload in edit mode - create new content via S3 and update profile

          const file = data.file[0];
          if (!file) {
            throw new Error(t('upload.noFileSelected'));
          }
          const mediaType = getMediaType(file);
          if (!mediaType) {
            throw new Error(t('upload.unsupportedType'));
          }
          const response = await contentApi.uploadContentViaS3(
            file,
            {
              media_type: mediaType,
              title: data.title || '',
              author: data.author || '',
              has_spanish_subtitles: data.has_spanish_subtitles ?? false,
              has_spanish_dubbing: data.has_spanish_dubbing ?? false,
              personalNote: '',
              is_visible: true,
              is_producer: false
            },
            (e) => {
              if (e.total) setUploadProgress(Math.round(e.loaded / e.total * 100));
            }
          );


          // Update the existing content profile to reference the new content
          if (contentProfileId && response.content_id) {
            await contentApi.updateContentProfileContent(contentProfileId, response.content_id);

          }

          if (onContentUploaded) {
            onContentUploaded(response.content_profile);
          }

          setHasSavedSuccessfully(true);
          setSnackbar({
            open: true,
            message: t('upload.createdWithProfile'),
            severity: 'success'
          });
        } else {
          // URL update - update existing content


          const updateData = {
            media_type: data.media_type,
            original_title: data.title || '',
            original_author: data.author || '',
            url: data.url,
            has_spanish_subtitles: data.has_spanish_subtitles ?? false,
            has_spanish_dubbing: data.has_spanish_dubbing ?? false
          };


          const response = await contentApi.updateContent(contentId, updateData);


          if (onContentUploaded) {
            onContentUploaded(response);
          }

          setHasSavedSuccessfully(true);
          setSnackbar({
            open: true,
            message: t('upload.updated'),
            severity: 'success'
          });
        }
      } else {
        // Create new content
        if (currentIsUrlMode) {

          const formData = new FormData();
          const normalizedUrl = data.url && !data.url.match(/^https?:\/\//i) ?
          `https://${data.url}` : data.url;
          formData.append('url', normalizedUrl);
          formData.append('media_type', data.media_type);
          formData.append('is_producer', 'false');
          formData.append('is_visible', 'true');
          formData.append('title', data.title || '');
          formData.append('author', data.author || '');
          formData.append('has_spanish_subtitles', String(data.has_spanish_subtitles ?? false));
          formData.append('has_spanish_dubbing', String(data.has_spanish_dubbing ?? false));
          if (previewData) {
            formData.append('og_description', previewData.description || '');
            formData.append('og_image', previewData.image || '');
            formData.append('og_type', previewData.type || '');
            formData.append('og_site_name', previewData.siteName || '');
          }
          const response = await contentApi.uploadContent(formData);

          if (onContentUploaded) onContentUploaded(response.content_profile);
        } else {

          const file = data.file[0];
          if (!file) throw new Error(t('upload.noFileSelected'));
          const mediaType = getMediaType(file);
          if (!mediaType) throw new Error(t('upload.unsupportedType'));
          const response = await contentApi.uploadContentViaS3(
            file,
            {
              media_type: mediaType,
              title: data.title || '',
              author: data.author || '',
              has_spanish_subtitles: data.has_spanish_subtitles ?? false,
              has_spanish_dubbing: data.has_spanish_dubbing ?? false,
              personalNote: data.personalNote,
              is_visible: data.is_visible ?? true,
              is_producer: data.is_producer ?? false
            },
            (e) => {
              if (e.total) setUploadProgress(Math.round(e.loaded / e.total * 100));
            }
          );

          if (onContentUploaded) onContentUploaded(response.content_profile);
        }

        setHasSavedSuccessfully(true);
        reset();
        setPreviewData(null);
        setSnackbar({
          open: true,
          message: t('upload.uploaded'),
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      const fallback = t('upload.uploadError');
      const { fieldErrors, generalError: parsed } = applyApiErrorsToForm(
        error,
        setError,
        null,
        { personal_note: 'personalNote' },
      );
      let message = parsed;
      // Local thrown Errors (unsupported file, missing file) are already Spanish.
      if (!message && error instanceof Error && !error.response && error.message) {
        message = error.message;
      }
      if (!message && Object.keys(fieldErrors).length === 0) {
        message = fallback;
      }
      if (message) {
        setGeneralError(message);
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // Update the mode toggle handlers
  const handleModeToggle = (newMode) => {
    setHasSavedSuccessfully(false);


    setIsUrlMode(newMode);
    setValue('isUrlMode', newMode);
    setPreviewData(null);
    setPreviewError(null);

    // Preserve title, author, URL, and media_type when switching modes
    const currentTitle = watch('title');
    const currentAuthor = watch('author');
    const currentUrl = watch('url');
    const currentMediaType = watch('media_type');
    const currentHasSpanishSubtitles = watch('has_spanish_subtitles');
    const currentHasSpanishDubbing = watch('has_spanish_dubbing');


    reset({
      title: currentTitle || '',
      author: currentAuthor || '',
      has_spanish_subtitles: !!currentHasSpanishSubtitles,
      has_spanish_dubbing: !!currentHasSpanishDubbing,
      is_producer: false,
      is_visible: true,
      isUrlMode: newMode,
      url: newMode ? currentUrl || '' : '',
      file: null,
      media_type: newMode ? currentMediaType || '' : ''
    });


  };

  // Register file input with ref callback
  const fileInputRegistration = register('file');
  const { ref: fileInputRegisterRef, onChange: fileInputOnChange, ...fileInputRest } = fileInputRegistration;

  const handleFileDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isUploading) {
      setIsDragActive(true);
    }
  };

  const handleFileDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isUploading) {
      setIsDragActive(true);
    }
  };

  const handleFileDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    // Only reset when leaving the drop area, not when moving between children
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    setIsDragActive(false);
  };

  const handleFileDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);

    if (isUploading) return;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      return;
    }

    const [file] = files;
    if (!file) return;

    // Update react-hook-form value and trigger validation
    setValue('file', [file], { shouldValidate: true });
    if (typeof trigger === 'function') {
      trigger('file');
    }
    setHasSavedSuccessfully(false);
    handleFilePicked(file);
  };

  return (
    <Paper elevation={2} sx={{ p: 3, width: '100%' }}>
      {showModeToggle &&
      <>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            {isEditMode ? t('upload.changeSource') : t('upload.chooseHow')}
          </Typography>

          {/* Toggle Buttons - Styled as option cards */}
          <Box sx={{ mb: 4 }}>
            <ToggleButtonGroup
            value={isUrlMode ? 'url' : 'file'}
            exclusive
            onChange={(e, newMode) => {
              if (newMode !== null) {
                handleModeToggle(newMode === 'url');
              }
            }}
            fullWidth
            sx={{
              '& .MuiToggleButton-root': {
                py: 2.5,
                px: 3,
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 500,
                border: '2px solid',
                borderColor: 'divider',
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  borderColor: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'primary.dark'
                  }
                },
                '&:not(.Mui-selected)': {
                  backgroundColor: 'background.paper',
                  color: 'text.primary',
                  '&:hover': {
                    backgroundColor: 'action.hover'
                  }
                }
              }
            }}>
            
              <ToggleButton value="url" aria-label={t('upload.fromUrlAria')}>
                {t('upload.fromUrl')}
              </ToggleButton>
              <ToggleButton value="file" aria-label={t('upload.uploadFileAria')}>
                {t('upload.uploadFile')}
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </>
      }

      <form
        noValidate
        onSubmit={handleSubmit(onSubmit, () => {
          setGeneralError(t('upload.invalidForm'));
        })}
      >
        {generalError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setGeneralError('')}>
            {generalError}
          </Alert>
        )}
        {/* File or URL Input */}
        {!isUrlMode ?
        <FormControl fullWidth error={!!errors.file} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 500 }}>
              {t('upload.fileLabel')}
            </Typography>
            <Box
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleFileDragOver}
            onDragEnter={handleFileDragEnter}
            onDragLeave={handleFileDragLeave}
            onDrop={handleFileDrop}
            sx={{
              border: '2px dashed',
              borderRadius: 1,
              p: 2,
              cursor: isUploading ? 'default' : 'pointer',
              borderColor: isDragActive ? 'primary.main' : 'divider',
              backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
              transition: 'background-color 0.15s ease, border-color 0.15s ease'
            }}>
            
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <Button
                variant="outlined"
                sx={{ textTransform: 'none' }}
                disabled={isUploading}>
                
                  {t('upload.selectFile')}
                </Button>
                <input
                type="file"
                {...fileInputRest}
                ref={(e) => {
                  fileInputRef.current = e;
                  fileInputRegisterRef(e);
                }}
                onChange={(e) => {
                  fileInputOnChange(e);
                  setHasSavedSuccessfully(false);
                  handleFilePicked(e.target.files?.[0]);
                }}
                style={{ display: 'none' }} />
              
                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                  {watch('file')?.[0]?.name ? watch('file')[0].name : t('upload.noneSelected')}
                </Typography>
              </Stack>
              {watch('file')?.[0] && (() => {
              const inferredType = getMediaType(watch('file')[0]);
              return inferredType ?
              <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">{t('upload.detectedType')}</Typography>
                    <Chip
                  size="small"
                  label={mediaTypeLabel(inferredType)}
                  color="primary"
                  variant="outlined" />
                
                  </Box> :
              null;
            })()}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {t('upload.dropHint')}
              </Typography>
            </Box>
            {errors.file &&
          <FormHelperText error>
                {errors.file.message}
              </FormHelperText>
          }
          </FormControl> :

        <>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <TextField
              label={t('common.url')}
              variant="outlined"
              {...urlField}
              onChange={(e) => {
                urlField.onChange(e);
                setHasSavedSuccessfully(false);
              }}
              error={!!errors.url}
              helperText={errors.url?.message}
              disabled={isLoadingPreview} />
            
            </FormControl>
            
            {/* URL Preview/Error - Show immediately below URL field */}
            <URLPreview
            previewData={previewData}
            isLoading={isLoadingPreview}
            error={previewError} />
          
            
            {/* Media Type Selector for URL Content */}
            <FormControl fullWidth error={!!errors.media_type} sx={{ mb: 3 }}>
              <InputLabel id="media-type-label">{t('upload.contentType')}</InputLabel>
              <Controller
                name="media_type"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    labelId="media-type-label"
                    label={t('upload.contentType')}
                    value={field.value || ''}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      setHasSavedSuccessfully(false);
                    }}
                  >
                    <MenuItem value="VIDEO">{t('mediaType.VIDEO')}</MenuItem>
                    <MenuItem value="AUDIO">{t('mediaType.AUDIO')}</MenuItem>
                    <MenuItem value="TEXT">{t('mediaType.TEXT')}</MenuItem>
                    <MenuItem value="IMAGE">{t('mediaType.IMAGE')}</MenuItem>
                  </Select>
                )}
              />
              {errors.media_type &&
            <FormHelperText error>
                  {errors.media_type.message}
                </FormHelperText>
            }
            </FormControl>
          </>
        }

        {/* Common Fields: collapsible for file+image, otherwise always visible */}
        {!isUrlMode && getMediaType(watch('file')?.[0]) === 'IMAGE' ?
        <Box sx={{ mb: 2 }}>
            <Button
            fullWidth
            onClick={() => setTitleAuthorExpanded((e) => !e)}
            endIcon={titleAuthorExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{
              justifyContent: 'space-between',
              textTransform: 'none',
              color: 'text.secondary',
              py: 1,
              '&:hover': { backgroundColor: 'action.hover' }
            }}>
            
              {t('upload.titleAuthorOptional')}
            </Button>
            <Collapse in={titleAuthorExpanded}>
              <Box sx={{ pl: 0, pr: 0, pt: 0, pb: 1 }}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <TextField
                  label={t('common.author')}
                  variant="outlined"
                  {...authorField}
                  onChange={(e) => {
                    authorField.onChange(e);
                    setHasSavedSuccessfully(false);
                  }}
                  error={!!errors.author}
                  helperText={errors.author?.message} />
                
                </FormControl>
                <FormControl fullWidth sx={{ mb: 0 }}>
                  <TextField
                  label={t('common.title')}
                  variant="outlined"
                  {...titleField}
                  onChange={(e) => {
                    titleField.onChange(e);
                    setHasSavedSuccessfully(false);
                  }}
                  error={!!errors.title}
                  helperText={errors.title?.message} />
                
                </FormControl>
              </Box>
            </Collapse>
          </Box> :

        <>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <TextField
              label={t('common.author')}
              variant="outlined"
              {...authorField}
              onChange={(e) => {
                authorField.onChange(e);
                setHasSavedSuccessfully(false);
              }}
              error={!!errors.author}
              helperText={errors.author?.message} />
            
            </FormControl>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <TextField
              label={t('common.title')}
              variant="outlined"
              {...titleField}
              onChange={(e) => {
                titleField.onChange(e);
                setHasSavedSuccessfully(false);
              }}
              error={!!errors.title}
              helperText={errors.title?.message} />
            
            </FormControl>
          </>
        }

        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
            <Checkbox
              checked={watch('has_spanish_subtitles')}
              onChange={(e) => {
                setValue('has_spanish_subtitles', e.target.checked);
                setHasSavedSuccessfully(false);
              }}
              {...register('has_spanish_subtitles')} />

            }
            label={t('upload.spanishSubtitles')} />
          
          <FormControlLabel
            control={
            <Checkbox
              checked={watch('has_spanish_dubbing')}
              onChange={(e) => {
                setValue('has_spanish_dubbing', e.target.checked);
                setHasSavedSuccessfully(false);
              }}
              {...register('has_spanish_dubbing')} />

            }
            label={t('upload.spanishDubbing')} />
          
        </Box>

        {/* Producer and Visibility Options - Only for File Upload */}
        {!isUrlMode &&
        <Box sx={{ mt: 2 }}>
            <FormControlLabel
            control={
            <Checkbox
              checked={watch('is_producer')}
              onChange={(e) => setValue('is_producer', e.target.checked)}
              {...register('is_producer')} />

            }
            label={t('upload.iProduced')} />
          
            {watch('is_producer') &&
          <Box sx={{ ml: 3 }}>
                <FormControlLabel
              control={
              <Switch
                checked={watch('is_visible')}
                onChange={(e) => setValue('is_visible', e.target.checked)}
                {...register('is_visible')} />

              }
              label={t('upload.visibleInSearch')} />
            
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  {t('upload.producerVisibilityNote')}
                </Typography>
              </Box>
          }
          </Box>
        }

        {isUploading &&
        <Box sx={{ mt: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <LinearProgress
              variant={uploadProgress !== null ? 'determinate' : 'indeterminate'}
              value={uploadProgress ?? 0}
              sx={{ flex: 1, height: 8, borderRadius: 1 }} />
            
              {uploadProgress !== null &&
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>
                  {uploadProgress}%
                </Typography>
            }
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {uploadProgress !== null ?
            t('upload.uploadingFile') :
            t('common.uploadingEllipsis')}
            </Typography>
          </Box>
        }

        {hasSavedSuccessfully &&
        <Alert
          icon={<CheckCircleIcon />}
          severity="success"
          sx={{ mt: 2 }}>
          
            {t('upload.savedInLibrary')}
          </Alert>
        }

        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={isUploading || isLoadingPreview || hasSavedSuccessfully}
            startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : null}>
            
            {isUploading ?
            t('common.uploading') :
            hasSavedSuccessfully ?
            isEditMode ? t('upload.contentUpdated') : t('upload.contentSaved') :
            isEditMode ? t('upload.updateContent') : t('upload.saveContent')}
          </Button>
        </Stack>
      </form>
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}>
          
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>);

};

export default UploadContentForm;