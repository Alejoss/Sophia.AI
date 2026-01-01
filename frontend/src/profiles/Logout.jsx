import { useEffect, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiLogout } from '../api/profilesApi.js';
import { getUserFromLocalStorage, clearAuthenticationStatus } from '../context/localStorageUtils.js';
import { AuthContext } from '../context/AuthContext.jsx';

const Logout = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [error, setError] = useState(null);
  const { clearAuthState } = useContext(AuthContext);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const storedUser = getUserFromLocalStorage();
    if (storedUser && storedUser.username) {
      setUsername(storedUser.username);
    }

    const logoutUser = async () => {
      if (isLoggingOut) return; // Prevent multiple logout attempts
      
      try {
        setIsLoggingOut(true);
        console.log('Attempting to logout...');
        await apiLogout();
        clearAuthState();
        clearAuthenticationStatus();
        window.location.href = '/profiles/login/';
      } catch (error) {
        console.error('Logout failed:', error);
        setError(error.message || 'Error al cerrar sesión');
        clearAuthState();
        clearAuthenticationStatus();
        window.location.href = '/profiles/login/';
      }
    };

    logoutUser();

    // Cleanup function
    return () => {
      setIsLoggingOut(false);
    };
  }, []); // Remove clearAuthState from dependencies

  return (
    <div>
      {error ? (
        <div style={{ color: 'red' }}>Error: {error}</div>
      ) : (
        <div>Cerrando sesión de {username}...</div>
      )}
    </div>
  );
};

export default Logout;
