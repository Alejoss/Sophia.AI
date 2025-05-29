import { useEffect, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiLogout } from '../api/profilesApi.js';
import { getUserFromLocalStorage, setAuthenticationStatus, isAuthenticated } from '../context/localStorageUtils.js';
import { AuthContext } from '../context/AuthContext.jsx';

const Logout = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [error, setError] = useState(null);
  const { setAuthState, clearAccessToken } = useContext(AuthContext);

  useEffect(() => {
    const storedUser = getUserFromLocalStorage();
    if (storedUser && storedUser.username) {
      setUsername(storedUser.username);
    }
    const logoutUser = async () => {
      if (!isAuthenticated()) {
        console.log('User is not authenticated, redirecting to login.');
        navigate('/profiles/login/');
        return;
      }

      try {
        console.log('Attempting to logout...');
        await apiLogout();
        
        // Clear access token from context
        clearAccessToken();
        
        // Clear authentication status but keep user data
        setAuthenticationStatus(false);
        
        // Clear auth state but keep user info
        const storedUser = getUserFromLocalStorage();
        setAuthState({ 
          isAuthenticated: false, 
          user: storedUser // Keep user info for welcome back message
        });
        
        console.log('Logout successful, redirecting to login.');
        navigate('/profiles/login/');
      } catch (error) {
        console.error('Logout failed:', error);
        setError(error.message || 'Failed to logout');
        // Even if the API call fails, we should still clear auth state
        clearAccessToken();
        setAuthenticationStatus(false);
        const storedUser = getUserFromLocalStorage();
        setAuthState({ 
          isAuthenticated: false, 
          user: storedUser // Keep user info for welcome back message
        });
        
        // Wait a moment before redirecting
        await new Promise(resolve => setTimeout(resolve, 2000));
        navigate('/profiles/login/');
      }
    };

    logoutUser();
  }, [navigate, setAuthState, clearAccessToken]);

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
