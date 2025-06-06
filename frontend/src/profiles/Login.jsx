import {useState, useEffect, useContext} from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { apiLogin, checkAuth } from '../api/profilesApi.js';
import { getUserFromLocalStorage, setUserInLocalStorage,
  setAuthenticationStatus, isAuthenticated } from '../context/localStorageUtils.js';
import SocialLogin from '../components/SocialLogin';

/**
 * Regular Login Component
 * Handles traditional username/password login
 */
const Login = () => {
  const navigate = useNavigate();
  const { setAuthState, setAccessToken, updateAuthState } = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [backendAuthStatus, setBackendAuthStatus] = useState(false);

  useEffect(() => {
    // Log environment variables to verify they're accessible
    console.log('Google Client ID:', import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID);
    console.log('API URL:', import.meta.env.VITE_API_URL);

    const storedUser = getUserFromLocalStorage();
    const localStorageAuth = isAuthenticated();

    // check if the user is authenticated with the backend and sync with localStorage
    checkAuth().then((backendAuthStatus) => {
      setBackendAuthStatus(backendAuthStatus);
      if (localStorageAuth && backendAuthStatus) {
        console.log("User is already authenticated")
      } else if (backendAuthStatus && !localStorageAuth) {
        setAuthenticationStatus(true);
        setAuthState({
          isAuthenticated: true,
          user: storedUser
        });
      } else if (!backendAuthStatus && localStorageAuth) {
        console.log("User is authenticated but backend is not")
        setAuthenticationStatus(false);
        setAuthState({
          isAuthenticated: false,
          user: storedUser
        });
      }
    });

    if (storedUser) {
      setUsername(storedUser.username);
    }
  }, [setAuthState]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Submitting login form with:', { username, password });
    try {
      const response = await apiLogin({ username, password });
      const { access_token, ...userData } = response.data;
      
      // Use centralized auth state update
      updateAuthState(userData, access_token);
      
      navigate('/profiles/login_successful');
    } catch (error) {
      console.error('Login error:', error); // Debug log
      const errorMessage =
        error.response?.data?.error ||
        error.response?.statusText ||
        'Login failed: ' + error.message;
      setError(errorMessage);
    }
  };

  if (backendAuthStatus) {
    return (
      <div>
        <p>Already logged in as {username}, want to
          <Link to="/profiles/logout"> logout?</Link>
        </p>
      </div>
    );
  } else {
    return (
      <div className="login-container">
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div style={{ color: 'red' }}>{error}</div>}
          <button type="submit">Login</button>
        </form>
        
        <div className="social-login-section">
          <p>Or continue with</p>
           <SocialLogin />
        </div>
      </div>
    );
  }
};

export default Login;
