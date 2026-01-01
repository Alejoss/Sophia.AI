import { useState, useEffect, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import { apiLogin, checkAuth } from "../api/profilesApi.js";
import {
  getUserFromLocalStorage,
  setUserInLocalStorage,
  setAuthenticationStatus,
  isAuthenticated,
} from "../context/localStorageUtils.js";
import SocialLogin from "../components/SocialLogin";
import '../styles/login.css';

/**
 * Regular Login Component
 * Handles traditional username/password login
 */
const Login = () => {
  const navigate = useNavigate();
  const { setAuthState, updateAuthState } = useContext(AuthContext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [backendAuthStatus, setBackendAuthStatus] = useState(false);

  useEffect(() => {
    // Log environment variables to verify they're accessible
    console.log(
      "Google Client ID:",
      import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID
    );
    console.log("API URL:", import.meta.env.VITE_API_URL);

    const storedUser = getUserFromLocalStorage();
    const localStorageAuth = isAuthenticated();

    // check if the user is authenticated with the backend and sync with localStorage
    checkAuth().then((backendAuthStatus) => {
      setBackendAuthStatus(backendAuthStatus);
      if (localStorageAuth && backendAuthStatus) {
        console.log("User is already authenticated");
      } else if (backendAuthStatus && !localStorageAuth) {
        setAuthenticationStatus(true);
        setAuthState({
          isAuthenticated: true,
          user: storedUser,
        });
      } else if (!backendAuthStatus && localStorageAuth) {
        console.log("User is authenticated but backend is not");
        setAuthenticationStatus(false);
        setAuthState({
          isAuthenticated: false,
          user: storedUser,
        });
      }
    });

    if (storedUser) {
      setUsername(storedUser.username);
    }
  }, [setAuthState]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Submitting login form with:", { username, password });
    try {
      const response = await apiLogin({ username, password });
      console.log("Login API response:", response);

      if (response.data) {
        const { access_token, ...userData } = response.data;
        // Use centralized auth state update
        updateAuthState(userData, access_token);
        navigate("/profiles/login_successful");
      }
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.statusText ||
        "Error al iniciar sesión: " + error.message;
      setError(errorMessage);
    }
  };

  if (backendAuthStatus) {
    return (
      <div>
        <p>
          Ya has iniciado sesión como {username}, ¿deseas
          <Link to="/profiles/logout"> cerrar sesión?</Link>
        </p>
      </div>
    );
  } else {
    return (
      <div className="login-container">
        <div className="login-wrapper">
          <div className="order-m-2 text-center">
            <img src="/images/login-img.png" className="inline-block" alt="" />
          </div>
          <div>
            <h2 className="heading-2 text-center">Iniciar sesión</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-5">
                <label className="form-label" htmlFor="username">
                  Nombre de usuario:
                </label>
                <input
                  type="text"
                  id="username"
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="mb-5">
                <label htmlFor="password" className="form-label">
                  Contraseña:
                </label>
                <input
                  type="password"
                  id="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <div style={{ color: "red" }}>{error}</div>}
              <button type="submit" className="btn-primary">
                Iniciar sesión
              </button>
            </form>

            <div className="social-login-section">
              <p>O continúa con</p>
              <SocialLogin />
            </div>
          </div>
        </div>
      </div>
    );
  }
};

export default Login;
