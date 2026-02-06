import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { getUserFromLocalStorage, isAuthenticated, setUserInLocalStorage, setAuthenticationStatus, 
  getAccessTokenFromLocalStorage, setAccessTokenInLocalStorage, removeAccessTokenFromLocalStorage, removeUserFromLocalStorage, clearAuthenticationStatus } from './localStorageUtils';
import { checkAuth } from '../api/profilesApi';
import { jwtDecode } from 'jwt-decode';
import axiosInstance from '../api/axiosConfig';

export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Authentication Context Provider
 * 
 * This component manages the application's authentication state, including:
 * - User authentication status
 * - Access token management (in memory)
 * - User data persistence (in localStorage for UX)
 * - Token refresh scheduling
 * 
 * The context provides the following functionality:
 * - updateAuthState: Centralized function to update auth state across all login methods
 * - setAccessToken: Stores access token in memory and schedules refresh
 * - getAccessToken: Retrieves the current access token
 * - clearAccessToken: Clears the access token and cancels refresh
 */

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    user: null,
  });
  const [authInitialized, setAuthInitialized] = useState(false);
  
  const refreshTimeoutRef = useRef(null);

  const updateAuthState = (userData, accessToken) => {
    if (accessToken) {
      setAccessTokenInLocalStorage(accessToken);
      scheduleTokenRefresh(accessToken);
    }

    setUserInLocalStorage(userData);
    setAuthenticationStatus(true);

    setAuthState({
      isAuthenticated: true,
      user: userData
    });
  };

  const clearAuthState = () => {
    removeAccessTokenFromLocalStorage();
    clearAuthenticationStatus();
    
    const storedUser = getUserFromLocalStorage();
    const username = storedUser ? storedUser.username : null;
    removeUserFromLocalStorage();
    
    if (username) {
      localStorage.setItem('user', JSON.stringify({ username }));
    }
    
    setAuthState({
      isAuthenticated: false,
      user: null
    });

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  };

  const scheduleTokenRefresh = (token) => {
    try {
      const decodedToken = jwtDecode(token);
      const expiresAt = decodedToken.exp * 1000;
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      const refreshTime = Math.max(0, timeUntilExpiry - 60000); // Refresh 1 minute before expiry
      
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await axiosInstance.post('/profiles/refresh_token/');
          if (response.data.access_token) {
            setAccessTokenInLocalStorage(response.data.access_token);
            scheduleTokenRefresh(response.data.access_token);
          } else {
            clearAuthState();
          }
        } catch (error) {
          clearAuthState();
        }
      }, refreshTime);
    } catch (error) {
      // Token refresh scheduling failed
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const backendAuthStatus = await checkAuth();
        const storedUser = getUserFromLocalStorage();
        const storedAccessToken = getAccessTokenFromLocalStorage();

        if (backendAuthStatus && storedUser && storedAccessToken) {
          scheduleTokenRefresh(storedAccessToken);
          
          setAuthState({
            isAuthenticated: true,
            user: storedUser
          });
        } else {
          clearAuthState();
        }
      } catch (error) {
        clearAuthState();
      } finally {
        setAuthInitialized(true);
      }
    };

    initializeAuth();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    window.authContext = {
      updateAuthState,
      clearAuthState,
      authState
    };
  }, [authState]);

  return (
    <AuthContext.Provider value={{ 
      authState, 
      setAuthState,
      updateAuthState,
      clearAuthState,
      user: authState.user,
      isAuthenticated: authState.isAuthenticated,
      authInitialized
    }}>
      {children}
    </AuthContext.Provider>
  );
};
