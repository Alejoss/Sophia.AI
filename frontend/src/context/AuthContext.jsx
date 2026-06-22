import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { getUserFromLocalStorage, isAuthenticated, setUserInLocalStorage, setAuthenticationStatus, 
  getAccessTokenFromLocalStorage, setAccessTokenInLocalStorage, removeAccessTokenFromLocalStorage, removeUserFromLocalStorage, clearAuthenticationStatus } from './localStorageUtils';
import { checkAuth, getUserProfile } from '../api/profilesApi';

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

  const updateAuthState = useCallback((userData, accessToken) => {
    if (accessToken) {
      setAccessTokenInLocalStorage(accessToken);
    }

    setUserInLocalStorage(userData);
    setAuthenticationStatus(true);

    setAuthState({
      isAuthenticated: true,
      user: userData
    });
  }, []);

  const clearAuthState = useCallback(() => {
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
  }, []);

  const restoreAuthenticatedSession = useCallback(async () => {
    const storedAccessToken = getAccessTokenFromLocalStorage();
    if (!storedAccessToken) {
      return false;
    }

    let userToUse = getUserFromLocalStorage();
    if (!userToUse || userToUse.id == null) {
      const profile = await getUserProfile();
      if (profile?.user) {
        userToUse = profile.user;
        setUserInLocalStorage(userToUse);
      }
    }

    if (!userToUse) {
      return false;
    }

    setAuthenticationStatus(true);
    setAuthState({
      isAuthenticated: true,
      user: userToUse,
    });
    return true;
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const backendAuthStatus = await checkAuth();

        if (backendAuthStatus) {
          const restored = await restoreAuthenticatedSession();
          if (!restored) {
            clearAuthState();
          }
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
  }, [clearAuthState, restoreAuthenticatedSession]);

  useEffect(() => {
    const onStorage = (event) => {
      if (!event.key || !['access_token', 'is_authenticated', 'user'].includes(event.key)) {
        return;
      }
      if (getAccessTokenFromLocalStorage() && isAuthenticated()) {
        restoreAuthenticatedSession();
      } else {
        clearAuthState();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [clearAuthState, restoreAuthenticatedSession]);

  useEffect(() => {
    const onRefreshFailed = () => {
      clearAuthState();
    };
    window.addEventListener('auth:token_refresh_failed', onRefreshFailed);
    return () => {
      window.removeEventListener('auth:token_refresh_failed', onRefreshFailed);
    };
  }, []);

  useEffect(() => {
    window.authContext = {
      updateAuthState,
      clearAuthState,
      authState
    };
  }, [clearAuthState]);

  const contextValue = useMemo(() => ({
    authState,
    setAuthState,
    updateAuthState,
    clearAuthState,
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    authInitialized,
  }), [authState, authInitialized, updateAuthState, clearAuthState]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
