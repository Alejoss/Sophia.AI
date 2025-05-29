import React, { createContext, useState, useEffect, useRef } from 'react';
import { getUserFromLocalStorage, isAuthenticated } from './localStorageUtils';
import { checkAuth } from '../api/profilesApi';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    user: null,
  });
  
  // Store access token in a ref to prevent unnecessary re-renders
  const accessTokenRef = useRef(null);
  const refreshTimeoutRef = useRef(null);

  const setAccessToken = (token) => {
    accessTokenRef.current = token;
    if (token) {
      // Schedule token refresh before it expires
      scheduleTokenRefresh(token);
    }
  };

  const getAccessToken = () => {
    return accessTokenRef.current;
  };

  const clearAccessToken = () => {
    accessTokenRef.current = null;
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  };

  const scheduleTokenRefresh = (token) => {
    try {
      const decodedToken = jwtDecode(token);
      const expiresAt = decodedToken.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      
      // Refresh token 1 minute before it expires
      const refreshTime = Math.max(0, timeUntilExpiry - 60000);
      
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch('http://localhost:8000/api/profiles/refresh_token/', {
            method: 'POST',
            credentials: 'include',
          });
          
          if (response.ok) {
            const data = await response.json();
            setAccessToken(data.access_token);
          } else {
            // If refresh fails, clear auth state
            clearAccessToken();
            setAuthState({ isAuthenticated: false, user: null });
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
          clearAccessToken();
          setAuthState({ isAuthenticated: false, user: null });
        }
      }, refreshTime);
    } catch (error) {
      console.error('Error scheduling token refresh:', error);
    }
  };

  // Expose auth context to window for axios interceptors
  useEffect(() => {
    window.authContext = {
      getAccessToken,
      setAccessToken,
      clearAccessToken,
      setAuthState,
      authState
    };
  }, [authState]);

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

    // Cleanup on unmount
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      authState, 
      setAuthState, 
      setAccessToken, 
      getAccessToken, 
      clearAccessToken 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
