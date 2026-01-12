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
  Card,
  CardMedia,
  CardContent,
  Avatar,
  Skeleton,
  Select,
  MenuItem
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
      <Alert severity="error" sx={{ mt: 2, mb: 3, position: 'relative', zIndex: 1 }}>
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

const schema = yup.object({
  file: yup.mixed().when('isUrlMode', {
    is: false,
    then: () => yup.mixed().required('El archivo es requerido'),
    otherwise: () => yup.mixed().nullable()
  }),
  url: yup.string().when('isUrlMode', {
    is: true,
    then: () => yup.string().url('Debe ser una URL válida').required('La URL es requerida'),
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

const UploadContentForm = ({ onContentUploaded, initialData = null, isEditMode = false, contentId = null, contentProfileId = null }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isUrlMode, setIsUrlMode] = useState(!!initialData?.url);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  
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
      isUrlMode: !!initialData?.url,
      media_type: initialData?.media_type || '',
      url: initialData?.url || ''
    }
  });

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
      return;
    }

    console.log('\n=== URL Preview Effect ===');
    console.log('URL changed:', url);

    // Clear any previous timeout
    if (urlDebounceTimeout.current) {
      console.log('Clearing previous debounce timeout');
      clearTimeout(urlDebounceTimeout.current);
    }

    // Validate URL before fetching preview
    trigger('url').then(isValid => {
      console.log('URL validation result:', isValid);
      if (!isValid) {
        console.log('URL validation failed, skipping preview');
        return;
      }

      // Set a new timeout to fetch preview
      console.log('Setting debounce timeout for preview fetch');
      urlDebounceTimeout.current = setTimeout(async () => {
        console.log('Debounce timeout triggered, fetching preview...');
        setIsLoadingPreview(true);
        setPreviewError(null);

                  try {
            console.log('Fetching metadata for URL:', url);
            const metadata = await contentApi.fetchUrlMetadata(url);
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
            setPreviewError(error.message || 'No se pudo cargar la vista previa para esta URL');
          } finally {
            setIsLoadingPreview(false);
          }
      }, 500); // Debounce for 500ms
    });

    // Cleanup timeout on unmount
    return () => {
      if (urlDebounceTimeout.current) {
        console.log('Cleaning up debounce timeout on unmount');
        clearTimeout(urlDebounceTimeout.current);
      }
    };
  }, [url, isUrlMode, setValue, trigger, watch]);

  const onSubmit = async (data) => {
    setIsUploading(true);
    try {
      console.log('\n=== Form Submit ===');
      console.log('Form data:', data);
      console.log('isUrlMode:', isUrlMode);
      console.log('isEditMode:', isEditMode);
      console.log('contentId:', contentId);
      
      if (isEditMode && contentId) {
        // Edit mode - update existing content
        console.log('Edit mode - updating existing content');
        
        if (!isUrlMode) {
          // File upload in edit mode - create new content and update profile
          console.log('File upload in edit mode - creating new content');
          
          const formData = new FormData();
          const file = data.file[0];
          if (!file) {
            throw new Error('No se seleccionó ningún archivo');
          }
          
          formData.append('file', file);
          formData.append('is_producer', false);
          formData.append('is_visible', true);
          
          const mediaType = getMediaType(file);
          if (!mediaType) {
            throw new Error('Tipo de archivo no soportado');
          }
          formData.append('media_type', mediaType);
          formData.append('title', data.title || '');
          formData.append('author', data.author || '');
          
          // Create new content
          const response = await contentApi.uploadContent(formData);
          console.log('New content created:', response);
          
          // Update the existing content profile to reference the new content
          if (contentProfileId && response.content_id) {
            await contentApi.updateContentProfileContent(contentProfileId, response.content_id);
            console.log('Content profile updated to reference new content');
          }
          
          if (onContentUploaded) {
            onContentUploaded(response.content_profile);
          }
          
          alert('¡Nuevo contenido creado exitosamente! El perfil de contenido ha sido actualizado para referenciar el nuevo archivo.');
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
          
          alert('¡Contenido actualizado exitosamente!');
        }
      } else {
        // Create new content
        const formData = new FormData();
        
        if (isUrlMode) {
          console.log('URL mode submission');
          // URL mode - send URL and preview data
          formData.append('url', data.url);
          formData.append('media_type', data.media_type);
          formData.append('is_producer', false);
          formData.append('is_visible', true);
          
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
          formData.append('is_producer', data.is_producer || false);
          formData.append('is_visible', data.is_visible || true);
          
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
        const response = await contentApi.uploadContent(formData);
        console.log('API Response:', response);
        
        if (onContentUploaded) {
          onContentUploaded(response.content_profile);
        }

        reset();
        setPreviewData(null);
        alert('¡Contenido subido exitosamente!');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert(error.response?.data?.error || error.message || 'Error al subir contenido. Por favor, inténtalo de nuevo.');
    } finally {
      setIsUploading(false);
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

  return (
    <Box sx={{ width: '100%', '& .MuiFormControl-root': { marginBottom: 2 } }}>
      <Typography variant="h6" gutterBottom>
        {isEditMode ? 'Cambiar fuente del contenido' : 'Subir contenido'}
      </Typography>

      {/* Toggle Buttons */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
        <Button
          variant={!isUrlMode ? "contained" : "outlined"}
          onClick={() => handleModeToggle(false)}
          size="large"
        >
          Subir archivo
        </Button>
        <Button
          variant={isUrlMode ? "contained" : "outlined"}
          onClick={() => handleModeToggle(true)}
          size="large"
        >
          Agregar desde URL
        </Button>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* File or URL Input */}
        {!isUrlMode ? (
          <FormControl fullWidth error={!!errors.file}>
            <Typography variant="subtitle2" gutterBottom>
              Archivo:
            </Typography>
            <input
              type="file"
              {...register('file')}
            />
            {errors.file && (
              <FormHelperText error>
                {errors.file.message}
              </FormHelperText>
            )}
          </FormControl>
        ) : (
          <>
            <FormControl fullWidth>
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
            
            {/* Media Type Selector for URL Content */}
            <FormControl fullWidth error={!!errors.media_type}>
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
            
            <URLPreview 
              previewData={previewData}
              isLoading={isLoadingPreview}
              error={previewError}
            />
          </>
        )}

        {/* Common Fields */}
        <FormControl fullWidth>
          <TextField
            label="Título original"
            variant="outlined"
            {...register('title')}
            error={!!errors.title}
            helperText={errors.title?.message}
          />
        </FormControl>

        <FormControl fullWidth>
          <TextField
            label="Autor original"
            variant="outlined"
            {...register('author')}
            error={!!errors.author}
            helperText={errors.author?.message}
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
        )}

        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          disabled={isUploading || isLoadingPreview}
          sx={{ mt: 3 }}
        >
          {isUploading ? 'Subiendo...' : (isEditMode ? 'Actualizar contenido' : 'Subir contenido')}
        </Button>
      </form>
    </Box>
  );
};

export default UploadContentForm; 
