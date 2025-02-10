import React, { createContext, useState, useEffect } from 'react';
import { getUserFromLocalStorage, isAuthenticated } from './localStorageUtils';
import { checkAuth } from '../api/profilesApi';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    user: null,
  });

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const backendAuthStatus = await checkAuth();
        const storedUser = getUserFromLocalStorage();
        const localStorageAuth = isAuthenticated();

        if (backendAuthStatus && localStorageAuth) {
          setAuthState({
            isAuthenticated: true,
            user: storedUser
          });
        } else {
          // If either backend or localStorage auth fails, consider user not authenticated
          setAuthState({
            isAuthenticated: false,
            user: storedUser // Keep the user info for convenience
          });
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        setAuthState({
          isAuthenticated: false,
          user: null
        });
      }
    };

    initializeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ authState, setAuthState }}>
      {children}
    </AuthContext.Provider>
  );
};
