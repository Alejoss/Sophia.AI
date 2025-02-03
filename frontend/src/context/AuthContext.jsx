import React, { createContext, useState, useEffect } from 'react';
import { getUserFromLocalStorage, isAuthenticated } from './localStorageUtils';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    user: null,
  });

  useEffect(() => {
    if (isAuthenticated()) {
      // confirm the user is authenticated with the backend ??
    }
    const storedUser = getUserFromLocalStorage();
    const userIsAuthenticated = isAuthenticated();
    setAuthState({
      isAuthenticated: userIsAuthenticated,
      user: storedUser || null,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ authState, setAuthState }}>
      {children}
    </AuthContext.Provider>
  );
};
