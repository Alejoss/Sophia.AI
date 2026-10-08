import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  Stack,
  Grid,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { useTranslation } from 'react-i18next';
import knowledgePathsApi from '../api/knowledgePathsApi';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';
import i18n from '../i18n';

const schema = yup.object({
  title: yup
    .string()
    .trim()
    .required(() => i18n.t('paths:common.titleRequired')),
  description: yup
    .string()
    .trim()
    .required(() => i18n.t('paths:create.descriptionRequired')),
});

const KnowledgePathCreationForm = () => {
  const { t } = useTranslation('paths');
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [generalError, setGeneralError] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { title: '', description: '' },
  });

  const titleValue = watch('title');

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async ({ title, description }) => {
    setGeneralError(null);

    try {
      const submitData = { title, description };
      if (selectedImage) {
        submitData.image = selectedImage;
      }

      const data = await knowledgePathsApi.createKnowledgePath(submitData);
      navigate(`/knowledge_path/${data.id}/edit`);
    } catch (err) {
      const imageErrors = err?.response?.data?.image;
      if (imageErrors) {
        const imageMsg = Array.isArray(imageErrors) ? imageErrors.join(' ') : String(imageErrors);
        setGeneralError(t('create.imageError', { message: imageMsg }));
      }

      const { generalError: parsed } = applyApiErrorsToForm(
        err,
        setError,
        t('create.error'),
      );

      if (!imageErrors && parsed) {
        setGeneralError(parsed);
      }
    }
  };

  return (
    <Container sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, md: 3 } }}>
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h4" component="h1" sx={{ mb: 1.5 }}>
                {t('create.title')}
              </Typography>
              {generalError && (
                <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>
                  {generalError}
                </Alert>
              )}
            </Box>

            <Paper sx={{ p: 3, height: '100%' }}>
              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
                    {t('create.cover')}
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: 2,
                      alignItems: { xs: 'stretch', sm: 'flex-start' },
                    }}
                  >
                    <Box
                      sx={{
                        width: { xs: '100%', sm: 240 },
                        height: 135,
                        borderRadius: 2,
                        bgcolor: 'grey.300',
                        overflow: 'hidden',
                        position: 'relative',
                        flexShrink: 0,
                      }}
                    >
                      {imagePreview ? (
                        <Box
                          component="img"
                          src={imagePreview}
                          alt="Knowledge Path Cover"
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '3rem',
                            color: 'text.secondary',
                            fontWeight: 700,
                          }}
                        >
                          {titleValue ? titleValue.charAt(0).toUpperCase() : 'K'}
                        </Box>
                      )}
                    </Box>
                    <Box>
                      <input
                        accept="image/*"
                        style={{ display: 'none' }}
                        id="image-upload"
                        type="file"
                        onChange={handleImageUpload}
                      />
                      <label htmlFor="image-upload">
                        <Button
                          component="span"
                          variant="outlined"
                          startIcon={<PhotoCameraIcon />}
                          disabled={isSubmitting}
                          sx={{
                            textTransform: 'none',
                            borderRadius: 2,
                          }}
                        >
                          {t('create.uploadCover')}
                        </Button>
                      </label>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {t('create.coverHint')}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <TextField
                  fullWidth
                  id="title"
                  label={t('common.title')}
                  {...register('title')}
                  error={!!errors.title}
                  helperText={errors.title?.message}
                  placeholder={t('create.titlePlaceholder')}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  id="description"
                  label={t('common.description')}
                  {...register('description')}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                  multiline
                  minRows={8}
                  maxRows={24}
                  placeholder={t('create.descriptionPlaceholder')}
                  sx={{ mb: 3 }}
                />

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={isSubmitting}
                    sx={{ minWidth: { xs: '100%', md: 'auto' } }}
                  >
                    {isSubmitting ? t('common.creating') : t('create.submit')}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => navigate('/knowledge_path')}
                    variant="contained"
                    color="inherit"
                    disabled={isSubmitting}
                    sx={{ minWidth: { xs: '100%', md: 'auto' } }}
                  >
                    {t('common.cancel')}
                  </Button>
                </Stack>
              </form>
            </Paper>
          </Grid>

          <Grid item xs={12} md={5}>
            <Paper
              sx={{
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box
                  sx={{
                    mr: 1.5,
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: 'primary.light',
                    color: 'primary.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <LightbulbIcon fontSize="small" />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {t('create.guideTitle')}
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary">
                {t('create.guideLead')}
              </Typography>

              <Box sx={{ mt: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {t('create.journeyTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('create.journey1')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('create.journey2')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('create.journey3')}
                </Typography>
              </Box>

              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {t('create.notJustTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('create.notJustBody')}
                </Typography>
              </Box>

              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {t('create.questionsTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('create.questions1')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('create.questions2')}
                </Typography>
              </Box>

              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  {t('create.closing')}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default KnowledgePathCreationForm;
