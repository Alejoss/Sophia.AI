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
        .required('El nombre de la colección es requerido')
        .min(3, 'El nombre de la colección debe tener al menos 3 caracteres')
        .max(100, 'El nombre de la colección no debe exceder 100 caracteres'),
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
            alert('Error al crear la colección. Por favor intenta de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Box sx={{ pt: 12, px: 3, maxWidth: 600, mx: 'auto' }}>
            <Paper sx={{ p: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Crear nueva colección
                </Typography>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <TextField
                        fullWidth
                        label="Nombre de la colección"
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
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Creando...' : 'Crear colección'}
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
};

export default CreateCollectionForm; 