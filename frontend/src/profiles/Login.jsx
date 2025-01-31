import {useState, useEffect, useContext} from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { apiLogin } from '../api/profilesApi.js';
import { getUserFromLocalStorage, setUserInLocalStorage, setAuthenticationStatus } from '../context/localStorageUtils.js';

const Login = () => {
  const navigate = useNavigate();
  const { setAuthState } = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const storedUser = getUserFromLocalStorage();
    console.log('storedUser:', storedUser);
    if (storedUser) {
      console.log('Username found:', storedUser.username);
      setUsername(storedUser.username); // Set the username in the state for the form input
    } else {
      console.log('No stored user found');
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
};

export default Login;