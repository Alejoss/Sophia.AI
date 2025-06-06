import { useEffect, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiLogout } from '../api/profilesApi.js';
import { getUserFromLocalStorage } from '../context/localStorageUtils.js';
import { AuthContext } from '../context/AuthContext.jsx';

const Logout = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [error, setError] = useState(null);
  const { clearAuthState } = useContext(AuthContext);

  useEffect(() => {
    const storedUser = getUserFromLocalStorage();
    if (storedUser && storedUser.username) {
      setUsername(storedUser.username);
    }

    const logoutUser = async () => {
      try {
        console.log('Attempting to logout...');
        
        // First clear the auth state
        clearAuthState();
        
        // Then call the API to logout
        await apiLogout();
        
        console.log('Logout successful, redirecting to login.');
        navigate('/profiles/login/');
      } catch (error) {
        console.error('Logout failed:', error);
        setError(error.message || 'Failed to logout');
        
        // Even if the API call fails, we've already cleared the auth state
        // Just wait a moment before redirecting
        await new Promise(resolve => setTimeout(resolve, 2000));
        navigate('/profiles/login/');
      }
    };

    logoutUser();
  }, [navigate, clearAuthState]);

  return (
    <div>
      {error ? (
        <div style={{ color: 'red' }}>Error: {error}</div>
      ) : (
        <div>Logging out {username}...</div>
      )}
    </div>
  );
};

export default Logout;
