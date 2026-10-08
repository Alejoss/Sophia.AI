import { useEffect, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiLogout } from '../api/profilesApi.js';
import { getUserFromLocalStorage, clearAuthenticationStatus } from '../context/localStorageUtils.js';
import { AuthContext } from '../context/AuthContext.jsx';

const Logout = () => {
  const { t } = useTranslation('profiles');
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

        await apiLogout();
        clearAuthState();
        clearAuthenticationStatus();
        window.location.href = '/profiles/login/';
      } catch (error) {
        console.error('Logout failed:', error);
        setError(error.message || t('logout.error'));
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
      {error ?
      <div style={{ color: 'red' }}>{t('logout.errorPrefix', { message: error })}</div> :

      <div>{t('logout.closing', { username })}</div>
      }
    </div>);

};

export default Logout;