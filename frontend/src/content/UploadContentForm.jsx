import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import axiosInstance from '../api/axiosConfig';
import contentApi from '../api/contentApi';
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
  Snackbar
} from '@mui/material';

const getMediaType = (file) => {
  if (!file || !file.type) return null;
  
  // Check the MIME type
  if (file.type.startsWith('image/')) return 'IMAGE';
  if (file.type.startsWith('video/')) return 'VIDEO';
  if (file.type.startsWith('audio/')) return 'AUDIO';
  if (file.type === 'application/pdf' ||
      file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'TEXT';
  }
  
  // Check file extension as fallback
  const extension = file.name.split('.').pop().toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const videoExts = ['mp4', 'webm', 'avi', 'mov'];
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a'];
  const textExts = ['txt', 'pdf', 'doc', 'docx', 'rtf'];
  
  if (imageExts.includes(extension)) return 'IMAGE';
  if (videoExts.includes(extension)) return 'VIDEO';
  if (audioExts.includes(extension)) return 'AUDIO';
  if (textExts.includes(extension)) return 'TEXT';
  
  return null;
};

// URL Preview Component
const URLPreview = ({ previewData, isLoading, error }) => {
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
      </Card>
    );
  }

  if (error) {
    return (
      <Alert severity="warning" sx={{ mt: 2, mb: 3, position: 'relative', zIndex: 1 }}>
        {error}
      </Alert>
    );
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
      {previewData.image && (
        <Box sx={{ position: 'relative', width: 140, minWidth: 140, height: 140 }}>
          <CardMedia
            component="img"
            sx={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover'
            }}
            image={previewData.image}
            alt={previewData.title || 'Preview image'}
          />
          {isYouTube && (
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
              }}
            >
              <Box
                sx={{
                  width: 0,
                  height: 0,
                  borderTop: '8px solid transparent',
                  borderBottom: '8px solid transparent',
                  borderLeft: '16px solid white',
                  marginLeft: '4px'
                }}
              />
            </Box>
          )}
        </Box>
      )}
      <CardContent sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {previewData.favicon && (
            <Avatar 
              src={previewData.favicon} 
              sx={{ width: 20, height: 20, mr: 1 }}
            />
          )}
          {previewData.siteName && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {previewData.siteName}
            </Typography>
          )}
        </Box>
        {previewData.title && (
          <Typography variant="subtitle1" component="div" gutterBottom noWrap>
            {previewData.title}
          </Typography>
        )}
        {previewData.description && (
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {previewData.description}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

// Create schema function that can access current form values
const createSchema = () => yup.object({
  file: yup.mixed().when('isUrlMode', {
    is: false,
    then: () => yup.mixed().required('El archivo es requerido'),
    otherwise: () => yup.mixed().nullable()
  }),
  url: yup.string().when('isUrlMode', {
    is: true,
    then: () => yup.string()
      .required('La URL es requerida')
      .test('is-url', 'Debe ser una URL válida', function(value) {
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
    then: () => yup.string().oneOf(['VIDEO', 'AUDIO', 'TEXT', 'IMAGE'], 'Por favor selecciona un tipo de medio válido').required('El tipo de medio es requerido'),
    otherwise: () => yup.string().nullable()
  }),
  title: yup.string().max(100, 'El título no debe exceder 100 caracteres'),
  author: yup.string().max(100, 'El autor no debe exceder 100 caracteres'),
  is_producer: yup.boolean(),
  is_visible: yup.boolean(),
  isUrlMode: yup.boolean()
}).required();

const schema = createSchema();

const UploadContentForm = ({ onContentUploaded, initialData = null, isEditMode = false, contentId = null, contentProfileId = null, onUploadingChange, initialUrlMode = null, showModeToggle = true }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // 0-100 for file uploads, null when not uploading or URL mode
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Notify parent when uploading state changes
  useEffect(() => {
    if (onUploadingChange) {
      onUploadingChange(isUploading);
    }
  }, [isUploading, onUploadingChange]);
  const [isUrlMode, setIsUrlMode] = useState(initialUrlMode !== null ? initialUrlMode : !!initialData?.url);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const fileInputRef = React.useRef(null);
  
  // Determine initial isUrlMode value
  const initialIsUrlMode = initialUrlMode !== null ? initialUrlMode : !!initialData?.url;
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
    trigger
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      title: initialData?.title || '',
      author: initialData?.author || '',
      is_producer: false,
      is_visible: true,
      isUrlMode: initialIsUrlMode,
      media_type: initialData?.media_type || '',
      url: initialData?.url || ''
    }
  });

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

  // Watch the URL field for changes
  const url = watch('url');
  const urlDebounceTimeout = React.useRef(null);

  // Initialize form with initialData when in edit mode
  useEffect(() => {
    if (isEditMode && initialData) {
      console.log('Initializing form with initialData:', initialData);
      const isUrlContent = !!initialData.url;
      console.log('isUrlContent:', isUrlContent);
      
      setIsUrlMode(isUrlContent);
      setValue('isUrlMode', isUrlContent);
      
      // Set form values
      setValue('title', initialData.title || '');
      setValue('author', initialData.author || '');
      setValue('media_type', initialData.media_type || '');
      setValue('url', initialData.url || '');
      
      console.log('Form values set:', {
        title: initialData.title || '',
        author: initialData.author || '',
        media_type: initialData.media_type || '',
        url: initialData.url || ''
      });
      
      // If it's URL content, fetch preview
      if (isUrlContent && initialData.url) {
        contentApi.fetchUrlMetadata(initialData.url)
          .then(metadata => {
            setPreviewData(metadata);
          })
          .catch(error => {
            console.error('Failed to fetch initial preview:', error);
          });
      }
    }
  }, [isEditMode, initialData, setValue]);

  // Effect to fetch preview when URL changes
  useEffect(() => {
    if (!isUrlMode || !url) {
      console.log('URL preview disabled or no URL provided');
      setPreviewData(null);
      setPreviewError(null); // Clear error when URL is cleared
      return;
    }

    console.log('\n=== URL Preview Effect ===');
    console.log('URL changed:', url);

    // Clear any previous timeout and error immediately when URL changes
    if (urlDebounceTimeout.current) {
      console.log('Clearing previous debounce timeout');
      clearTimeout(urlDebounceTimeout.current);
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

    // Set a new timeout to fetch preview - increased debounce for better UX
    console.log('Setting debounce timeout for preview fetch');
    urlDebounceTimeout.current = setTimeout(async () => {
      console.log('Debounce timeout triggered, fetching preview...');
      
      // Check if URL looks valid before attempting fetch
      if (!looksLikeUrl(url)) {
        console.log('URL does not look valid, skipping preview');
        setPreviewError(null);
        return;
      }

      setIsLoadingPreview(true);
      setPreviewError(null);

      try {
        // Normalize URL before fetching
        const normalizedUrl = normalizeUrl(url);
        console.log('Fetching metadata for URL:', normalizedUrl);
        const metadata = await contentApi.fetchUrlMetadata(normalizedUrl);
        console.log('Received metadata:', metadata);
        setPreviewData(metadata);
        setPreviewError(null);  // Clear any previous errors

        // Auto-fill form fields if empty
        const currentTitle = watch('title');
        if (!currentTitle && metadata.title) {
          console.log('Auto-filling title:', metadata.title);
          setValue('title', metadata.title);
        }
      } catch (error) {
        console.error('Preview fetch error:', error);
        setPreviewData(null);  // Clear any previous preview data
        // Only show error if URL is still the same (url is captured in closure)
        // Check current URL value to ensure it hasn't changed
        const currentUrl = watch('url');
        if (currentUrl === url) {
          setPreviewError(error.message || 'No se pudo cargar la vista previa para esta URL');
        }
      } finally {
        setIsLoadingPreview(false);
      }
    }, 4000); // Increased debounce to 4000ms to give user more time

    // Cleanup timeout on unmount
    return () => {
      if (urlDebounceTimeout.current) {
        console.log('Cleaning up debounce timeout on unmount');
        clearTimeout(urlDebounceTimeout.current);
      }
    };
  }, [url, isUrlMode]); // Removed setValue, trigger, watch from dependencies to avoid unnecessary re-runs

  const onSubmit = async (data) => {
    console.log('\n=== Form Submit ===');
    console.log('Form data:', data);
    console.log('data.isUrlMode:', data.isUrlMode);
    console.log('isUrlMode state:', isUrlMode);
    console.log('isEditMode:', isEditMode);
    console.log('contentId:', contentId);
    
    // Use form data's isUrlMode if available, otherwise fall back to state
    const currentIsUrlMode = data.isUrlMode !== undefined ? data.isUrlMode : isUrlMode;
    console.log('Using isUrlMode:', currentIsUrlMode);
    
    setIsUploading(true);
    setUploadProgress(0);
    try {
      
      if (isEditMode && contentId) {
        // Edit mode - update existing content
        console.log('Edit mode - updating existing content');
        
        if (!currentIsUrlMode) {
          // File upload in edit mode - create new content and update profile
          console.log('File upload in edit mode - creating new content');
          
          const formData = new FormData();
          const file = data.file[0];
          if (!file) {
            throw new Error('No se seleccionó ningún archivo');
          }
          
          formData.append('file', file);
          // Send booleans as strings for consistent backend parsing
          formData.append('is_producer', 'false');
          formData.append('is_visible', 'true');
          
          const mediaType = getMediaType(file);
          if (!mediaType) {
            throw new Error('Tipo de archivo no soportado');
          }
          formData.append('media_type', mediaType);
          formData.append('title', data.title || '');
          formData.append('author', data.author || '');
          
          const response = await contentApi.uploadContent(formData, {
            onUploadProgress: (e) => {
              if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
            }
          });
          console.log('New content created:', response);
          
          // Update the existing content profile to reference the new content
          if (contentProfileId && response.content_id) {
            await contentApi.updateContentProfileContent(contentProfileId, response.content_id);
            console.log('Content profile updated to reference new content');
          }
          
          if (onContentUploaded) {
            onContentUploaded(response.content_profile);
          }
          
          setSnackbar({
            open: true,
            message: '¡Nuevo contenido creado exitosamente! El perfil de contenido ha sido actualizado para referenciar el nuevo archivo.',
            severity: 'success'
          });
        } else {
          // URL update - update existing content
          console.log('URL update mode - updating existing content');
          console.log('URL from form data:', data.url);
          console.log('Media type from form data:', data.media_type);
          console.log('Title from form data:', data.title);
          console.log('Author from form data:', data.author);
          
          const updateData = {
            media_type: data.media_type,
            original_title: data.title || '',
            original_author: data.author || '',
            url: data.url
          };
          
          console.log('Update data being sent to API:', updateData);
          const response = await contentApi.updateContent(contentId, updateData);
          console.log('Update Response:', response);
          
          if (onContentUploaded) {
            onContentUploaded(response);
          }
          
          setSnackbar({
            open: true,
            message: '¡Contenido actualizado exitosamente!',
            severity: 'success'
          });
        }
      } else {
        // Create new content
        const formData = new FormData();
        
        if (currentIsUrlMode) {
          console.log('URL mode submission');
          // URL mode - send URL and preview data
          // Normalize URL by adding https:// if missing
          const normalizedUrl = data.url && !data.url.match(/^https?:\/\//i) 
            ? `https://${data.url}` 
            : data.url;
          formData.append('url', normalizedUrl);
          formData.append('media_type', data.media_type);
          // URLs are always visible and not produced content
          formData.append('is_producer', 'false');
          formData.append('is_visible', 'true');
          
          // Add preview metadata if available
          if (previewData) {
            formData.append('og_description', previewData.description || '');
            formData.append('og_image', previewData.image || '');
            formData.append('og_type', previewData.type || '');
            formData.append('og_site_name', previewData.siteName || '');
          }
        } else {
          console.log('File mode submission');
          // File mode - send file data
          const file = data.file[0];
          if (!file) {
            throw new Error('No se seleccionó ningún archivo');
          }
          console.log('Selected file:', file);
          
          formData.append('file', file);
          // Use nullish coalescing so `false` is preserved, and send as strings
          formData.append('is_producer', String(data.is_producer ?? false));
          formData.append('is_visible', String(data.is_visible ?? true));
          
          const mediaType = getMediaType(file);
          console.log('Detected media type:', mediaType);
          if (!mediaType) {
            throw new Error('Tipo de archivo no soportado');
          }
          formData.append('media_type', mediaType);
        }

        // Common fields
        formData.append('title', data.title || '');
        formData.append('author', data.author || '');

        console.log('Submitting to API...');
        const uploadOptions = currentIsUrlMode
          ? {}
          : {
              onUploadProgress: (e) => {
                if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
              }
            };
        const response = await contentApi.uploadContent(formData, uploadOptions);
        console.log('API Response:', response);
        
        if (onContentUploaded) {
          onContentUploaded(response.content_profile);
        }

        reset();
        setPreviewData(null);
        setSnackbar({
          open: true,
          message: '¡Contenido subido exitosamente!',
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || error.message || 'Error al subir contenido. Por favor, inténtalo de nuevo.',
        severity: 'error'
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // Update the mode toggle handlers
  const handleModeToggle = (newMode) => {
    console.log('handleModeToggle called with newMode:', newMode);
    console.log('Current form values before reset:', {
      title: watch('title'),
      author: watch('author'),
      url: watch('url'),
      media_type: watch('media_type')
    });
    
    setIsUrlMode(newMode);
    setValue('isUrlMode', newMode);
    setPreviewData(null);
    setPreviewError(null);
    
    // Preserve title, author, URL, and media_type when switching modes
    const currentTitle = watch('title');
    const currentAuthor = watch('author');
    const currentUrl = watch('url');
    const currentMediaType = watch('media_type');
    
    console.log('Values to preserve:', {
      currentTitle,
      currentAuthor,
      currentUrl,
      currentMediaType
    });
    
    reset({
      title: currentTitle || '',
      author: currentAuthor || '',
      is_producer: false,
      is_visible: true,
      isUrlMode: newMode,
      url: newMode ? (currentUrl || '') : '',
      file: null,
      media_type: newMode ? (currentMediaType || '') : ''
    });
    
    console.log('Form reset completed');
  };

  // Register file input with ref callback
  const fileInputRegistration = register('file');
  const { ref: fileInputRegisterRef, onChange: fileInputOnChange, ...fileInputRest } = fileInputRegistration;

  return (
    <Paper elevation={2} sx={{ p: 3, width: '100%' }}>
      {showModeToggle && (
        <>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            {isEditMode ? 'Cambiar fuente del contenido' : 'Selecciona cómo agregar contenido'}
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
                      backgroundColor: 'primary.dark',
                    }
                  },
                  '&:not(.Mui-selected)': {
                    backgroundColor: 'background.paper',
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    }
                  }
                }
              }}
            >
              <ToggleButton value="url" aria-label="subir contenido desde url">
                Desde URL
              </ToggleButton>
              <ToggleButton value="file" aria-label="subir archivo">
                Subir Archivo
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </>
      )}

      <form onSubmit={handleSubmit(onSubmit, (errors) => {
        console.error('Form validation errors:', errors);
        console.error('Current isUrlMode state:', isUrlMode);
        console.error('Current isUrlMode form value:', watch('isUrlMode'));
        setSnackbar({
          open: true,
          message: 'Por favor completa todos los campos requeridos correctamente.',
          severity: 'error'
        });
      })}>
        {/* File or URL Input */}
        {!isUrlMode ? (
          <FormControl fullWidth error={!!errors.file} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 500 }}>
              Archivo:
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button
                variant="outlined"
                sx={{ textTransform: 'none' }}
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                Seleccionar archivo
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
                }}
                style={{ display: 'none' }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                {watch('file')?.[0]?.name ? watch('file')[0].name : 'Ningún archivo seleccionado'}
              </Typography>
            </Stack>
            {errors.file && (
              <FormHelperText error>
                {errors.file.message}
              </FormHelperText>
            )}
          </FormControl>
        ) : (
          <>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <TextField
                label="URL"
                variant="outlined"
                {...register('url')}
                value={watch('url') || ''}
                error={!!errors.url}
                helperText={errors.url?.message}
                disabled={isLoadingPreview}
              />
            </FormControl>
            
            {/* URL Preview/Error - Show immediately below URL field */}
            <URLPreview 
              previewData={previewData}
              isLoading={isLoadingPreview}
              error={previewError}
            />
            
            {/* Media Type Selector for URL Content */}
            <FormControl fullWidth error={!!errors.media_type} sx={{ mb: 3 }}>
              <InputLabel id="media-type-label">Tipo de contenido</InputLabel>
              <Select
                labelId="media-type-label"
                label="Tipo de contenido"
                {...register('media_type')}
                value={watch('media_type')}
                onChange={(e) => setValue('media_type', e.target.value)}
              >
                <MenuItem value="VIDEO">Video</MenuItem>
                <MenuItem value="AUDIO">Audio</MenuItem>
                <MenuItem value="TEXT">Texto</MenuItem>
                <MenuItem value="IMAGE">Imagen</MenuItem>
              </Select>
              {errors.media_type && (
                <FormHelperText error>
                  {errors.media_type.message}
                </FormHelperText>
              )}
            </FormControl>
          </>
        )}

        {/* Common Fields */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <TextField
            label="Autor"
            variant="outlined"
            {...register('author')}
            value={watch('author') || ''}
            onChange={(e) => setValue('author', e.target.value)}
            error={!!errors.author}
            helperText={errors.author?.message}
          />
        </FormControl>

        <FormControl fullWidth sx={{ mb: 3 }}>
          <TextField
            label="Título"
            variant="outlined"
            {...register('title')}
            value={watch('title') || ''}
            onChange={(e) => setValue('title', e.target.value)}
            error={!!errors.title}
            helperText={errors.title?.message}
          />
        </FormControl>

        {/* Producer and Visibility Options - Only for File Upload */}
        {!isUrlMode && (
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={watch('is_producer')}
                  onChange={(e) => setValue('is_producer', e.target.checked)}
                  {...register('is_producer')}
                />
              }
              label="He producido este contenido"
            />
            {watch('is_producer') && (
              <Box sx={{ ml: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={watch('is_visible')}
                      onChange={(e) => setValue('is_visible', e.target.checked)}
                      {...register('is_visible')}
                    />
                  }
                  label="Visible en los resultados de búsqueda"
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Nota: Solo el productor del contenido puede hacerlo invisible en los resultados de búsqueda.
                </Typography>
              </Box>
            )}
          </Box>
        )        }

        {isUploading && (
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <LinearProgress
                variant={uploadProgress !== null ? 'determinate' : 'indeterminate'}
                value={uploadProgress ?? 0}
                sx={{ flex: 1, height: 8, borderRadius: 1 }}
              />
              {uploadProgress !== null && (
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>
                  {uploadProgress}%
                </Typography>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {uploadProgress !== null
                ? 'Subiendo archivo… Puedes completar el formulario del nodo mientras tanto.'
                : 'Subiendo…'}
            </Typography>
          </Box>
        )}

        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={isUploading || isLoadingPreview}
            startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {isUploading ? 'Subiendo...' : (isEditMode ? 'Actualizar contenido' : 'Guardar Contenido')}
          </Button>
        </Stack>
      </form>
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default UploadContentForm; 
