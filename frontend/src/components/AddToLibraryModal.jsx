import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    IconButton,
    Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import contentApi from '../api/contentApi';

const AddToLibraryModal = ({ content, onSuccess, buttonProps = {} }) => {
    const [openModal, setOpenModal] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        author: '',
        personalNote: ''
    });

    const handleOpen = (event) => {
        if (event) {
            event.stopPropagation();
        }
        setFormData({
            title: content?.selected_profile?.title || content?.original_title || '',
            author: content?.selected_profile?.author || content?.original_author || '',
            personalNote: ''
        });
        setOpenModal(true);
    };

    const handleClose = () => {
        setOpenModal(false);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async () => {
        try {
            if (!content?.id) return;
            await contentApi.createContentProfile(content.id, formData);
            handleClose();
            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            console.error('Error adding to library:', error);
        }
    };

    return (
        <>
            <Tooltip title="Add to library">
                <IconButton
                    onClick={handleOpen}
                    color="primary"
                    size="small"
                    {...buttonProps}
                >
                    <AddIcon />
                </IconButton>
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
                <DialogTitle id="add-to-library-dialog-title">Add to Library</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            name="title"
                            label="Title"
                            value={formData.title}
                            onChange={handleFormChange}
                            fullWidth
                            required
                        />
                        <TextField
                            name="author"
                            label="Author"
                            value={formData.author}
                            onChange={handleFormChange}
                            fullWidth
                        />
                        <TextField
                            name="personalNote"
                            label="Personal Note"
                            value={formData.personalNote}
                            onChange={handleFormChange}
                            multiline
                            rows={4}
                            fullWidth
                            placeholder="Add your thoughts or notes about this content..."
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Cancel</Button>
                    <Button onClick={handleSubmit} variant="contained" color="primary">
                        Add to Library
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default AddToLibraryModal; 