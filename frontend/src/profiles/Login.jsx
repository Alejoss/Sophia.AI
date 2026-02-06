import { useState, useEffect, useContext } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import { apiLogin, checkAuth, refreshToken, getUserProfile } from "../api/profilesApi.js";
import {
  getUserFromLocalStorage,
  setAuthenticationStatus,
  isAuthenticated,
  getAccessTokenFromLocalStorage,
  setAccessTokenInLocalStorage,
} from "../context/localStorageUtils.js";
import SocialLogin from "../components/SocialLogin";
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import '../styles/login.css';

/**
 * Regular Login Component
 * Handles traditional username/email and password login
 */
const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authState, setAuthState, updateAuthState } = useContext(AuthContext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [backendAuthStatus, setBackendAuthStatus] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [loginImage, setLoginImage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Select a random login cover image (1-10)
    const randomImageNumber = Math.floor(Math.random() * 10) + 1;
    setLoginImage(`/images/login_cover/login_cover${randomImageNumber}.jpg`);

    // Log environment variables to verify they're accessible
    console.log(
      "Google Client ID:",
      import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID
    );
    console.log("API URL:", import.meta.env.VITE_API_URL);

    const storedUser = getUserFromLocalStorage();
    const localStorageAuth = isAuthenticated();

    // Check if the user is authenticated with the backend and sync with localStorage
    checkAuth().then((isBackendAuthenticated) => {
      setBackendAuthStatus(isBackendAuthenticated);
      if (localStorageAuth && isBackendAuthenticated) {
        console.log("User is already authenticated");
      } else if (isBackendAuthenticated && !authState.isAuthenticated) {
        // Backend says authenticated but context was cleared (e.g. after wrong redirect on refresh)
        // Restore session: get new token and user, then redirect away from login
        setIsRestoringSession(true);
        refreshToken()
          .then((data) => {
            const access_token = data?.access_token;
            if (!access_token) {
              setIsRestoringSession(false);
              return;
            }
            setAccessTokenInLocalStorage(access_token);
            return getUserProfile().then((profile) => {
              if (!profile?.user) {
                setIsRestoringSession(false);
                return;
              }
              updateAuthState(profile.user, access_token);
              const from = location.state?.from?.pathname || "/profiles/my_profile";
              navigate(from, { replace: true });
            });
          })
          .catch(() => {
            setIsRestoringSession(false);
            // Restore failed (e.g. no refresh cookie); backendAuthStatus is still true so we show "Ya has iniciado sesión"
          });
      } else if (isBackendAuthenticated && !localStorageAuth && storedUser) {
        setAuthenticationStatus(true);
        setAuthState({
          isAuthenticated: true,
          user: storedUser,
        });
      } else if (!isBackendAuthenticated && localStorageAuth) {
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
  }, [setAuthState, authState.isAuthenticated, updateAuthState, location.state?.from?.pathname, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Submitting login form with:", { username, password });
    try {
      // Check if user had previous session data before login using utilities
      const storedUser = getUserFromLocalStorage();
      const wasAuthenticated = isAuthenticated();
      const hadAccessToken = getAccessTokenFromLocalStorage() !== null;
      const hadPreviousSession = (storedUser !== null) || wasAuthenticated || hadAccessToken;
      
      const response = await apiLogin({ username, password });
      console.log("Login API response:", response);

      if (response.data) {
        const { access_token, ...userData } = response.data;
        // Mark if this is a returning user
        if (hadPreviousSession) {
          sessionStorage.setItem('had_previous_session', 'true');
        }
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

  // Restoring session after wrong redirect (e.g. refresh on protected route)
  if (isRestoringSession) {
    return (
      <div className="login-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="login-form-card" style={{ textAlign: 'center' }}>
          <p>Restaurando sesión...</p>
        </div>
      </div>
    );
  }

  // Already authenticated (backend says so); show message only when not restoring
  if (backendAuthStatus) {
    return (
      <div>
        <p>
          Ya has iniciado sesión como {username}, ¿deseas
          <Link to="/profiles/logout"> cerrar sesión?</Link>
        </p>
      </div>
    );
  }

  // Not authenticated: show login form
  return (
      <div className="login-container">
        <div className="login-wrapper">
          <div className="login-image-section">
            <img src={loginImage} className="login-image" alt="Login illustration" />
          </div>
          <div className="login-form-section">
            <div className="login-form-card">
              <h2 className="heading-2 text-center">Iniciar sesión</h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-5">
                  <label className="form-label" htmlFor="username">
                    Usuario o correo electrónico:
                  </label>
                  <input
                    type="text"
                    id="username"
                    className="form-control"
                    placeholder="Ingresa tu usuario o correo electrónico"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="mb-5">
                  <label htmlFor="password" className="form-label">
                    Contraseña:
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      className="form-control"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? (
                        <VisibilityOffIcon fontSize="small" />
                      ) : (
                        <VisibilityIcon fontSize="small" />
                      )}
                    </button>
                  </div>
                </div>
                {error && <div className="error-message">{error}</div>}
                <button type="submit" className="btn-primary">
                  Iniciar sesión
                </button>
              </form>

              <div className="social-login-section">
                <div className="divider">
                  <span>O continúa con</span>
                </div>
                <SocialLogin />
              </div>

              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <span>¿No tienes cuenta? </span>
                <Link to="/profiles/register" style={{ color: 'inherit', textDecoration: 'underline' }}>
                  Regístrate
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
};

export default Login;
