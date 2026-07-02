import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getUnreadNotificationsCount } from '../api/profilesApi';
import { useAuth } from './AuthContext.jsx';

const POLL_INTERVAL_MS = 60_000;
const MIN_REFRESH_INTERVAL_MS = 15_000;

const NotificationsContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};

export const NotificationsProvider = ({ children }) => {
  const { isAuthenticated, authInitialized } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const inFlightRef = useRef(false);
  const lastFetchRef = useRef(0);

  const refreshUnreadCount = useCallback(async (force = false) => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    const now = Date.now();
    if (!force && now - lastFetchRef.current < MIN_REFRESH_INTERVAL_MS) {
      return;
    }
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    try {
      const count = await getUnreadNotificationsCount();
      const normalized = typeof count === 'number' && count >= 0 ? count : 0;
      setUnreadCount(normalized);
      lastFetchRef.current = Date.now();
    } catch (error) {
      console.error('Error fetching unread notifications count:', error);
    } finally {
      inFlightRef.current = false;
    }
  }, [isAuthenticated]);

  const adjustUnreadCount = useCallback((delta) => {
    setUnreadCount((current) => Math.max(0, current + delta));
  }, []);

  useEffect(() => {
    if (!authInitialized) {
      return undefined;
    }

    if (!isAuthenticated) {
      setUnreadCount(0);
      lastFetchRef.current = 0;
      return undefined;
    }

    refreshUnreadCount(true);

    const intervalId = window.setInterval(() => {
      refreshUnreadCount(true);
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshUnreadCount(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authInitialized, isAuthenticated, refreshUnreadCount]);

  const value = useMemo(() => ({
    unreadCount,
    setUnreadCount,
    adjustUnreadCount,
    refreshUnreadCount,
  }), [unreadCount, adjustUnreadCount, refreshUnreadCount]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};
