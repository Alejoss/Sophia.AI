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
  
  const accessTokenRef = useRef(null);
  const refreshTimeoutRef = useRef(null);

  const updateAuthState = (userData, accessToken) => {
    console.log('Updating auth state with:', { userData, hasAccessToken: !!accessToken });
    
    // Store access token in memory and localStorage
    if (accessToken) {
      setAccessToken(accessToken);
      setAccessTokenInLocalStorage(accessToken);
    }

    // Store user data in localStorage for UX purposes
    setUserInLocalStorage(userData);
    setAuthenticationStatus(true);

    // Update React context state - ensure both user and isAuthenticated are set together
    setAuthState({
      isAuthenticated: true,
      user: userData
    });
    console.log('Auth state updated:', { isAuthenticated: true, user: userData });
  };

  const clearAuthState = () => {
    console.log('Clearing auth state');
    clearAccessToken();
    removeAccessTokenFromLocalStorage();
    // Don't remove user data from localStorage, only clear auth status
    clearAuthenticationStatus();
    
    // Always clear both isAuthenticated and user together
    setAuthState({
      isAuthenticated: false,
      user: null
    });
  };

  const setAccessToken = (token) => {
    console.log('Setting access token in memory:', token ? 'Token exists' : 'No token');
    accessTokenRef.current = token;
    if (token) {
      scheduleTokenRefresh(token);
    }
  };

  const getAccessToken = () => {
    console.log('Getting access token from memory:', accessTokenRef.current ? 'Token exists' : 'No token');
    return accessTokenRef.current;
  };

  const clearAccessToken = () => {
    console.log('Clearing access token from memory');
    accessTokenRef.current = null;
    removeAccessTokenFromLocalStorage();
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  };

  const scheduleTokenRefresh = (token) => {
    try {
      console.log('Scheduling token refresh');
      const decodedToken = jwtDecode(token);
      const expiresAt = decodedToken.exp * 1000;
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      const refreshTime = Math.max(0, timeUntilExpiry - 60000);
      
      console.log('Token refresh scheduled for:', new Date(now + refreshTime));
      
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      refreshTimeoutRef.current = setTimeout(async () => {
        console.log('Attempting to refresh token');
        try {
          const response = await axiosInstance.post('/profiles/refresh_token/');
          if (response.data.access_token) {
            console.log('Token refresh successful');
            setAccessToken(response.data.access_token);
          } else {
            console.log('Token refresh failed - no new token received');
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

  useEffect(() => {
    const initializeAuth = async () => {
      console.log('Initializing authentication state');
      try {
        const backendAuthStatus = await checkAuth();
        console.log('Backend auth status:', backendAuthStatus);
        
        const storedUser = getUserFromLocalStorage();
        console.log('Stored user:', storedUser);
        
        const localStorageAuth = isAuthenticated();
        console.log('LocalStorage auth status:', localStorageAuth);
        
        const storedAccessToken = getAccessTokenFromLocalStorage();
        console.log('Stored access token:', storedAccessToken ? 'Token exists' : 'No token');

        if (backendAuthStatus && storedUser && storedAccessToken) {
          console.log('All auth components present, restoring session');
          // Restore access token to memory
          setAccessToken(storedAccessToken);
          
          // Set both isAuthenticated and user together
          setAuthState({
            isAuthenticated: true,
            user: storedUser
          });
          console.log('Session restored successfully');
        } else {
          console.log('Missing auth components, clearing session:', {
            backendAuthStatus,
            hasStoredUser: !!storedUser,
            hasStoredToken: !!storedAccessToken
          });
          // Clear everything if any part is missing
          clearAuthState();
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        clearAuthState();
      }
    };

    initializeAuth();

    return () => {
      if (refreshTimeoutRef.current) {
        console.log('Cleaning up token refresh timeout');
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  // Expose auth context to window for axios interceptors
  useEffect(() => {
    window.authContext = {
      getAccessToken: () => accessTokenRef.current,
      setAccessToken: (token) => {
        setAccessToken(token);
      },
      clearAccessToken: () => {
        clearAccessToken();
      },
      setAuthState: (newState) => {
        // Ensure isAuthenticated and user are always set together
        setAuthState({
          isAuthenticated: !!newState.user,
          user: newState.user
        });
      },
      authState
    };
  }, [authState]);

  return (
    <AuthContext.Provider value={{ 
      authState, 
      setAuthState,
      updateAuthState,
      setAccessToken, 
      getAccessToken, 
      clearAccessToken,
      clearAuthState,
      user: authState.user,
      isAuthenticated: authState.isAuthenticated
    }}>
      {children}
    </AuthContext.Provider>
  );
};
