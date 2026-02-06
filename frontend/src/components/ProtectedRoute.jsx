import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const { authState, authInitialized } = useContext(AuthContext);

  if (!authInitialized) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!authState.isAuthenticated) {
    return <Navigate to="/profiles/login" replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;
