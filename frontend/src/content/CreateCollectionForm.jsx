import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Paper, FormControlLabel, Switch } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import contentApi from '../api/contentApi';

const schema = yup.object().shape({
    name: yup
        .string()
        .required('El nombre de la colección es requerido')
        .min(3, 'El nombre de la colección debe tener al menos 3 caracteres')
        .max(100, 'El nombre de la colección no debe exceder 100 caracteres'),
    is_public: yup.boolean().default(false),
});

const CreateCollectionForm = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();
    const { register, handleSubmit, control, formState: { errors } } = useForm({
        resolver: yupResolver(schema),
        defaultValues: { name: '', is_public: false },
    });

    const onSubmit = async (data) => {
        setIsSubmitting(true);
        try {
            await contentApi.createCollection({
                name: data.name,
                is_public: !!data.is_public,
            });
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
                        sx={{ mb: 2 }}
                    />

                    <Controller
                        name="is_public"
                        control={control}
                        render={({ field }) => (
                            <FormControlLabel
                                sx={{ mb: 2, display: 'flex', alignItems: 'flex-start' }}
                                control={
                                    <Switch
                                        checked={!!field.value}
                                        onChange={(_, v) => field.onChange(v)}
                                        color="primary"
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography variant="body2" component="span" display="block">
                                            Colección pública
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            Aparecerá en la sección de colecciones públicas de la biblioteca (solo ítems marcados como visibles en búsqueda).
                                        </Typography>
                                    </Box>
                                }
                            />
                        )}
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
