import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import contentApi from '../api/contentApi';
import { applyApiErrorsToForm } from '../utils/apiFormErrors';

const schema = yup.object({
  title: yup
    .string()
    .trim()
    .required(() => i18n.t('misc:library.titleRequired')),
  author: yup.string().trim().default(''),
  personalNote: yup.string().trim().default(''),
});

const getDefaultTitle = (content) =>
  content?.selected_profile?.title ||
  content?.title ||
  content?.content?.original_title ||
  content?.original_title ||
  '';

const getDefaultAuthor = (content) =>
  content?.selected_profile?.author ||
  content?.author ||
  content?.content?.original_author ||
  content?.original_author ||
  '';

const AddToLibraryModal = ({ content, onSuccess, buttonProps = {} }) => {
  const { t } = useTranslation('misc');
  const [openModal, setOpenModal] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { title: '', author: '', personalNote: '' },
  });

  const handleOpen = (event) => {
    if (event) {
      event.stopPropagation();
    }

    setGeneralError('');
    reset({
      title: getDefaultTitle(content),
      author: getDefaultAuthor(content),
      personalNote: '',
    });
    setOpenModal(true);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setOpenModal(false);
    setGeneralError('');
  };

  const onSubmit = async (formData) => {
    setGeneralError('');

    const contentId = content?.content?.id || content?.id;

    if (!contentId) {
      setGeneralError(t('library.identifyFailed'));
      return;
    }

    try {
      await contentApi.createContentProfile(contentId, formData);
      setOpenModal(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error adding to library:', error);
      const { generalError: parsed } = applyApiErrorsToForm(
        error,
        setError,
        t('library.addFailed'),
        { personal_note: 'personalNote', title: 'title', author: 'author' },
      );
      if (parsed) {
        setGeneralError(parsed);
      }
    }
  };

  return (
    <>
      <Tooltip title={t('library.add')}>
        {buttonProps?.variant ? (
          <Button onClick={handleOpen} startIcon={<AddIcon />} {...buttonProps}>
            {t('library.add')}
          </Button>
        ) : (
          <IconButton onClick={handleOpen} color="primary" size="small" {...buttonProps}>
            <AddIcon />
          </IconButton>
        )}
      </Tooltip>

      <Dialog
        open={openModal}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        keepMounted={false}
        disablePortal={false}
        aria-labelledby="add-to-library-dialog-title"
      >
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogTitle id="add-to-library-dialog-title">{t('library.dialogTitle')}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label={t('library.titleLabel')}
                {...register('title')}
                error={!!errors.title}
                helperText={errors.title?.message}
                fullWidth
                required
              />

              <TextField
                label={t('library.authorLabel')}
                {...register('author')}
                error={!!errors.author}
                helperText={errors.author?.message}
                fullWidth
              />

              <TextField
                label={t('library.noteLabel')}
                {...register('personalNote')}
                error={!!errors.personalNote}
                helperText={errors.personalNote?.message}
                multiline
                rows={4}
                fullWidth
                placeholder={t('library.notePlaceholder')}
              />

              {generalError && <Alert severity="error">{generalError}</Alert>}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={isSubmitting}>
              {t('library.cancel')}
            </Button>
            <Button type="submit" variant="contained" color="primary" disabled={isSubmitting}>
              {isSubmitting ? t('library.adding') : t('library.add')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
};

export default AddToLibraryModal;
