// src/api/gamificationApi.js
import axiosInstance from './axiosConfig.js';

/**
 * Gamification API service
 * Centralized API calls for badges and points system
 */

/**
 * Get all available badges
 * @returns {Promise<Object>} Response data with badges list
 * @throws {Error} If request fails
 */
export const getAllBadges = async () => {
  try {
    const response = await axiosInstance.get('/gamification/badges/');
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.message || 'Error al cargar badges';
    console.error('Error fetching badges:', error);
    
    // Handle specific error cases
    if (error.response?.status === 401) {
      throw new Error('No autorizado. Por favor, inicia sesión.');
    } else if (error.response?.status === 404) {
      throw new Error('Badges no encontrados');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('La solicitud expiró. Por favor, inténtelo de nuevo.');
    }
    
    throw new Error(errorMessage);
  }
};

/**
 * Get badges for the authenticated user
 * @returns {Promise<Object>} Response data with user badges, total points, and badge count
 * @throws {Error} If request fails
 */
export const getMyBadges = async () => {
  try {
    const response = await axiosInstance.get('/gamification/user-badges/my_badges/');
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.message || 'Error al cargar tus badges';
    console.error('Error fetching user badges:', error);
    
    if (error.response?.status === 401) {
      throw new Error('No autorizado. Por favor, inicia sesión.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('La solicitud expiró. Por favor, inténtelo de nuevo.');
    }
    
    throw new Error(errorMessage);
  }
};

/**
 * Get badges for a specific user
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Response data with user badges
 * @throws {Error} If request fails
 */
export const getUserBadges = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const response = await axiosInstance.get(`/gamification/user-badges/?user_id=${userId}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.message || 'Error al cargar badges del usuario';
    console.error(`Error fetching badges for user ${userId}:`, error);
    
    if (error.response?.status === 404) {
      throw new Error(`Usuario con ID ${userId} no encontrado.`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('La solicitud expiró. Por favor, inténtelo de nuevo.');
    }
    
    throw new Error(errorMessage);
  }
};

/**
 * Get total points for the authenticated user
 * @returns {Promise<Object>} Response data with total points
 * @throws {Error} If request fails
 */
export const getMyPoints = async () => {
  try {
    const response = await axiosInstance.get('/gamification/points/my_points/');
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.message || 'Error al cargar puntos';
    console.error('Error fetching user points:', error);
    
    if (error.response?.status === 401) {
      throw new Error('No autorizado. Por favor, inicia sesión.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('La solicitud expiró. Por favor, inténtelo de nuevo.');
    }
    
    throw new Error(errorMessage);
  }
};

/**
 * Grant a badge to a user (admin only)
 * @param {number} badgeId - Badge ID
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Response data with granted badge
 * @throws {Error} If request fails
 */
export const grantBadge = async (badgeId, userId) => {
  if (!badgeId || !userId) {
    throw new Error('Badge ID and User ID are required');
  }

  try {
    const response = await axiosInstance.post(`/gamification/badges/${badgeId}/grant/`, {
      user_id: userId
    });
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.message || 'Error al otorgar badge';
    console.error('Error granting badge:', error);
    
    if (error.response?.status === 403) {
      throw new Error('No tienes permisos para otorgar badges');
    } else if (error.response?.status === 404) {
      throw new Error('Badge o usuario no encontrado');
    } else if (error.response?.status === 400) {
      throw new Error(error.response.data.error || 'El usuario ya tiene este badge');
    }
    
    throw new Error(errorMessage);
  }
};