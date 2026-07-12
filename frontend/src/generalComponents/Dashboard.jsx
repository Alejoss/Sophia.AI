import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, Typography, CircularProgress } from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import TopicCreationRequestsAdmin from '../topics/TopicCreationRequestsAdmin';

const Dashboard = () => {
    const { authState, authInitialized } = useContext(AuthContext);

    if (!authInitialized) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!authState.isAuthenticated) {
        return <Navigate to="/profiles/login" replace />;
    }

    if (!authState.user?.is_staff) {
        return <Navigate to="/" replace />;
    }

    return (
        <Box sx={{ pt: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
            <Typography variant="h4" gutterBottom>
                Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                Panel de administración de la plataforma.
            </Typography>
            <TopicCreationRequestsAdmin embedded />
        </Box>
    );
};

export default Dashboard;
