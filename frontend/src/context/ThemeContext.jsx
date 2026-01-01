import React, { createContext, useContext, useState, useEffect } from 'react';
import { createTheme } from '@mui/material/styles';
import createThemeConfig from '../theme/theme';

export const ThemeContext = createContext();

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Get system preference for color scheme
 */
const getSystemPreference = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

/**
 * Get stored theme preference from localStorage
 */
const getStoredPreference = () => {
  try {
    const stored = localStorage.getItem('theme_mode');
    return stored === 'dark' || stored === 'light' ? stored : null;
  } catch (error) {
    return null;
  }
};

/**
 * Save theme preference to localStorage
 */
const setStoredPreference = (mode) => {
  try {
    localStorage.setItem('theme_mode', mode);
  } catch (error) {
    console.error('Failed to save theme preference:', error);
  }
};

/**
 * Theme Provider Component
 * Manages dark/light mode state and provides theme to Material-UI
 */
export const ThemeProvider = ({ children }) => {
  // Initialize mode: stored preference OR system preference OR 'light'
  const [mode, setMode] = useState(() => {
    const stored = getStoredPreference();
    if (stored) return stored;
    return getSystemPreference();
  });

  // Create theme based on current mode
  const theme = createTheme(createThemeConfig(mode));

  // Update document attribute for CSS variable-based dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  // Listen to system preference changes (only if no stored preference)
  useEffect(() => {
    const stored = getStoredPreference();
    if (stored) return; // Don't listen if user has manually set preference

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setMode(e.matches ? 'dark' : 'light');
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } 
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  /**
   * Toggle between light and dark mode
   */
  const toggleMode = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    setStoredPreference(newMode);
  };

  const value = {
    mode,
    toggleMode,
    theme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

