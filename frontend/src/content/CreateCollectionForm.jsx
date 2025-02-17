import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import contentApi from '../api/contentApi';

const schema = yup.object().shape({
    name: yup
        .string()
        .required('Collection name is required')
        .min(3, 'Collection name must be at least 3 characters')
        .max(100, 'Collection name must not exceed 100 characters'),
});

const CreateCollectionForm = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();
    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: yupResolver(schema)
    });

    const onSubmit = async (data) => {
        setIsSubmitting(true);
        try {
            await contentApi.createCollection(data);
            navigate('/content/collections');
        } catch (error) {
            console.error('Failed to create collection:', error);
            alert('Failed to create collection. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Box sx={{ pt: 12, px: 3, maxWidth: 600, mx: 'auto' }}>
            <Paper sx={{ p: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Create New Collection
                </Typography>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <TextField
                        fullWidth
                        label="Collection Name"
                        {...register('name')}
                        error={!!errors.name}
                        helperText={errors.name?.message}
                        sx={{ mb: 3 }}
                    />

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            type="button"
                            variant="outlined"
                            onClick={() => navigate('/content/collections')}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Creating...' : 'Create Collection'}
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
};

export default CreateCollectionForm; 