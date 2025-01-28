import { useEffect, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiLogout } from '../api/profilesApi.js';
import { getUserFromLocalStorage, setAuthenticationStatus, isAuthenticated } from '../context/localStorageUtils.js';
import { AuthContext } from '../context/AuthContext.jsx';

const Logout = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const { setAuthState } = useContext(AuthContext);

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
        setAuthenticationStatus(false);  // Local Storage
        setAuthState({ isAuthenticated: false, user: null });  // Context
        console.log('Logout successful, redirecting to login.');
      } catch (error) {
        console.error('Logout failed:', error);
      }
      await new Promise(resolve => setTimeout(resolve, 4000));
      navigate('/profiles/login/');
    };

    logoutUser();
  }, [navigate]);

  return (
    <div>Logging out {username}...</div>
  );
};

export default Logout;
