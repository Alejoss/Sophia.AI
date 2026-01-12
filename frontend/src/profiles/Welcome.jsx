import React, { useEffect, useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { setUserInLocalStorage, setAuthenticationStatus, clearUserFromLocalStorage, clearAuthenticationStatus } from '../context/localStorageUtils.js';
import { checkAuth } from '../api/profilesApi.js';
import '../styles/Welcome.css'; // We can create this for styling

const Welcome = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { authState, setAuthState } = useContext(AuthContext);
  const [message, setMessage] = useState('Verificando tu sesión...');
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const userDataFromState = location.state?.user;

    const verifyAndSetAuth = async () => {
      try {
        const backendAuthenticated = await checkAuth();

        if (backendAuthenticated && userDataFromState) {
          // Backend confirms auth (cookie is set and valid)
          // and we have user data from registration step
          setUserInLocalStorage(userDataFromState);
          setAuthenticationStatus(true);
          setAuthState({
            isAuthenticated: true,
            user: userDataFromState,
          });
          setMessage(`Welcome, ${userDataFromState.username}! Your account is active and you are now logged in.`);
          setIsVerified(true);
        } else if (backendAuthenticated && !userDataFromState && authState.isAuthenticated) {
          // This case might happen if user refreshes /welcome or navigates directly with a valid cookie
          // but without registration state. AuthContext might already be populated.
          setMessage(`¡Bienvenido de nuevo, ${authState.user?.username || 'Usuario'}! Has iniciado sesión.`);
          setIsVerified(true);
        } else {
          // Verification failed or user data is missing where it's expected
          clearUserFromLocalStorage();
          clearAuthenticationStatus();
          setAuthState({
            isAuthenticated: false,
            user: null,
          });
          setMessage('La verificación de sesión falló. Por favor intenta iniciar sesión.');
          setIsVerified(false);
          // Optional: Redirect to login after a delay
          // setTimeout(() => navigate('/profiles/login'), 3000);
        }
      } catch (error) {
        console.error("Error during auth verification on Welcome page:", error);
        clearUserFromLocalStorage();
        clearAuthenticationStatus();
        setAuthState({
          isAuthenticated: false,
          user: null,
        });
        setMessage('Ocurrió un error durante la verificación de sesión. Por favor intenta iniciar sesión.');
        setIsVerified(false);
      }
    };

    if (location.state?.user) {
        verifyAndSetAuth();
    } else {
        // If no state is passed (e.g. direct navigation or refresh), rely on AuthContext's initial check or redirect
        // For now, we'll check auth again, or guide to login if authState isn't set.
        if (authState.isAuthenticated) {
            setMessage(`¡Bienvenido de nuevo, ${authState.user?.username || 'Usuario'}! Has iniciado sesión.`);
            setIsVerified(true);
        } else {
            // If no user data passed via state and context not authed, check with backend
            verifyAndSetAuth(); 
        }
    }

  }, [location.state, setAuthState, navigate, authState.isAuthenticated, authState.user]);

  return (
    <div className="welcome-container">
      <h2>¡Bienvenido!</h2>
      <p className={`status-message ${isVerified ? 'success' : 'error'}`}>{message}</p>
      {isVerified && authState.user && (
        <div className="welcome-actions">
          <p>¿Qué te gustaría hacer ahora?</p>
          <Link to="/profiles/my_profile" className="welcome-link">Ver tu perfil</Link>
        </div>
      )}
      {!isVerified && (
        <div className="welcome-actions">
            <Link to="/profiles/login" className="welcome-link">Ir a iniciar sesión</Link>
        </div>
      )}
    </div>
  );
};

export default Welcome; 