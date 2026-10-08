import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    Alert,
    CircularProgress,
    Chip,
    Card,
    CardContent,
    CardActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Divider
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/Pending';
import { useTranslation } from 'react-i18next';
import contentApi from '../api/contentApi';
import { useDateLocales } from '../hooks/useDateLocales';

const MyContentSuggestions = () => {
    const navigate = useNavigate();
    const { t } = useTranslation('topics');
    const { intl } = useDateLocales();
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchSuggestions();
    }, [statusFilter, t]);

    const fetchSuggestions = async () => {
        try {
            setLoading(true);
            const filters = {};
            if (statusFilter && statusFilter !== 'all') {
                filters.status = statusFilter;
            }
            const data = await contentApi.getUserContentSuggestions(filters);
            setSuggestions(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err) {
            setError(t('suggestion.loadMineError'));
            console.error('Error fetching suggestions:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusChip = (status) => {
        const statusConfig = {
            PENDING: { 
                label: t('common.pending'), 
                color: 'warning',
                icon: <PendingIcon fontSize="small" />
            },
            ACCEPTED: { 
                label: t('suggestion.statusAccepted'), 
                color: 'success',
                icon: <CheckCircleIcon fontSize="small" />
            },
            REJECTED: { 
                label: t('suggestion.statusRejected'), 
                color: 'error',
                icon: <CancelIcon fontSize="small" />
            }
        };
        const config = statusConfig[status] || { label: status, color: 'default', icon: null };
        return (
            <Chip 
                label={config.label} 
                color={config.color} 
                icon={config.icon}
                size="small" 
            />
        );
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                {error}
            </Alert>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" gutterBottom>
                    {t('suggestion.myTitle')}
                </Typography>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>{t('suggestion.filterByStatus')}</InputLabel>
                    <Select
                        value={statusFilter}
                        label={t('suggestion.filterByStatus')}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <MenuItem value="all">{t('suggestion.allFeminine')}</MenuItem>
                        <MenuItem value="PENDING">{t('suggestion.statusPendingPlural')}</MenuItem>
                        <MenuItem value="ACCEPTED">{t('suggestion.statusAcceptedPlural')}</MenuItem>
                        <MenuItem value="REJECTED">{t('suggestion.statusRejectedPlural')}</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            {suggestions.length === 0 ? (
                <Alert severity="info">
                    {t('suggestion.emptyMine')}
                </Alert>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {suggestions.map((suggestion) => (
                        <Card key={suggestion.id} variant="outlined">
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                                    <Box sx={{ flexGrow: 1 }}>
                                        <Typography variant="h6" gutterBottom>
                                            {suggestion.content?.original_title || t('common.untitled')}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('suggestion.topicLine', { title: suggestion.topic?.title || t('suggestion.unknownTopic') })}
                                        </Typography>
                                    </Box>
                                    {getStatusChip(suggestion.status)}
                                </Box>

                                {suggestion.message && (
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>{t('suggestion.yourMessage')}</strong> {suggestion.message}
                                        </Typography>
                                    </Box>
                                )}

                                {suggestion.status === 'REJECTED' && suggestion.rejection_reason && (
                                    <Alert severity="error" sx={{ mb: 2 }}>
                                        <Typography variant="body2">
                                            <strong>{t('user.rejectionReason')}</strong> {suggestion.rejection_reason}
                                        </Typography>
                                    </Alert>
                                )}

                                {suggestion.is_duplicate && (
                                    <Chip 
                                        label={t('common.alreadyInTopic')} 
                                        size="small" 
                                        color="warning" 
                                        sx={{ mb: 1 }}
                                    />
                                )}

                                <Typography variant="caption" color="text.secondary">
                                    {t('common.suggestedOn')} {suggestion.created_at ? new Date(suggestion.created_at).toLocaleString(intl) : '-'}
                                </Typography>

                                {suggestion.reviewed_at && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        {t('common.reviewedOn')} {new Date(suggestion.reviewed_at).toLocaleString(intl)}
                                        {suggestion.reviewed_by && t('suggestion.byUser', { user: suggestion.reviewed_by.username })}
                                    </Typography>
                                )}
                            </CardContent>
                            <CardActions>
                                <Button 
                                    size="small" 
                                    onClick={() => navigate(`/content/topics/${suggestion.topic?.id}`)}
                                >
                                    {t('suggestion.viewTopic')}
                                </Button>
                            </CardActions>
                        </Card>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default MyContentSuggestions;
