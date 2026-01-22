import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { authState } = useContext(AuthContext);

  if (!authState.isAuthenticated) {
    // Redirect to login page if not authenticated
    return <Navigate to="/profiles/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
