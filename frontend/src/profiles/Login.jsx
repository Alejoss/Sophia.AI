import {useState, useEffect, useContext} from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { apiLogin, checkAuth } from '../api/profilesApi.js';
import { getUserFromLocalStorage, setUserInLocalStorage,
  setAuthenticationStatus, isAuthenticated } from '../context/localStorageUtils.js';

const Login = () => {
  const navigate = useNavigate();
  const { setAuthState } = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [backendAuthStatus, setBackendAuthStatus] = useState(false);

  useEffect(() => {
    const storedUser = getUserFromLocalStorage();
    const localStorageAuth = isAuthenticated();

    // check if the user is authenticated with the backend and sync with localStorage
    checkAuth().then((backendAuthStatus) => {
      setBackendAuthStatus(backendAuthStatus);
      if (localStorageAuth && backendAuthStatus) {
        console.log("User is already authenticated")
      } else if (backendAuthStatus && !localStorageAuth) {
        setAuthenticationStatus(true);
      } else if (!backendAuthStatus && localStorageAuth) {
        setAuthenticationStatus(false);
      }
    });

    if (storedUser) {
      setUsername(storedUser.username);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Submitting login form with:', { username, password }); // Debugging line
    try {
      const userData = await apiLogin({ username, password });
      setUserInLocalStorage(userData); // Save the user data in local storage
      setAuthenticationStatus(true); // Set the authentication status to true
      setAuthState({
        isAuthenticated: true,
        user: userData,
      })
      navigate('/profiles/login_successful'); // Redirect to LoginSuccessful component
    } catch (error) {
      const errorMessage =
        error.response?.data?.error ||
        error.response?.statusText || // Fallback to the HTTP status text
        'Login failed: ' + error.message; // General fallback
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
    );
    }
};

export default Login;
