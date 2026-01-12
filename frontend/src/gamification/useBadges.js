import { useState, useEffect } from 'react';
import { getMyBadges, getUserBadges, getAllBadges } from '../api/gamificationApi';

/**
 * Custom hook for managing badges data
 * Provides loading states, error handling, and data fetching
 */
export const useBadges = (userId = null) => {
  const [badges, setBadges] = useState([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        setLoading(true);
        setError(null);

        let data;
        if (userId) {
          // Fetch badges for specific user
          const badgesData = await getUserBadges(userId);
          data = {
            badges: badgesData.results || badgesData,
            total_points: 0, // Not available for other users
            badge_count: badgesData.results?.length || badgesData.length || 0
          };
        } else {
          // Fetch own badges
          data = await getMyBadges();
        }

        setBadges(data.badges || []);
        setTotalPoints(data.total_points || 0);
        setBadgeCount(data.badge_count || data.badges?.length || 0);
      } catch (err) {
        console.error('Error fetching insignias:', err);
        setError(err.message || 'Error al cargar insignias');
        setBadges([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBadges();
  }, [userId]);

  return {
    badges,
    totalPoints,
    badgeCount,
    loading,
    error,
    refetch: () => {
      setLoading(true);
      // Trigger useEffect again
      const fetchBadges = async () => {
        try {
          setError(null);
          let data;
          if (userId) {
            const badgesData = await getUserBadges(userId);
            data = {
              badges: badgesData.results || badgesData,
              total_points: 0,
              badge_count: badgesData.results?.length || badgesData.length || 0
            };
          } else {
            data = await getMyBadges();
          }
          setBadges(data.badges || []);
          setTotalPoints(data.total_points || 0);
          setBadgeCount(data.badge_count || data.badges?.length || 0);
        } catch (err) {
          console.error('Error fetching insignias:', err);
          setError(err.message || 'Error al cargar insignias');
        } finally {
          setLoading(false);
        }
      };
      fetchBadges();
    }
  };
};

/**
 * Custom hook for fetching all available badges
 */
export const useAllBadges = () => {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAllBadges = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAllBadges();
        setBadges(data.results || data || []);
      } catch (err) {
        console.error('Error fetching all insignias:', err);
        setError(err.message || 'Error al cargar insignias disponibles');
        setBadges([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAllBadges();
  }, []);

  return { badges, loading, error };
};