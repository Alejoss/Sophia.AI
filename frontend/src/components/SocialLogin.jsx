import { useCallback, useContext, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { socialLogin } from '../api/profilesApi';
import { GoogleLogin } from '@react-oauth/google';
import {
  getUserFromLocalStorage,
  isAuthenticated,
  getAccessTokenFromLocalStorage,
} from '../context/localStorageUtils';
import { getAuthNextPath } from '../utils/authNext';

const SocialLoginContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 1rem 0;
`;

const ErrorMessage = styled.div`
  color: #dc3545;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  padding: 0.75rem;
  margin: 0.5rem 0;
  font-size: 0.875rem;
`;

/**
 * Google OAuth login/signup (same SocialLogin used on Login/Register).
 * @param {string} [redirectTo] — post-auth path (e.g. /club-de-lectura/:slug).
 *   Falls back to ?next= / location.state.from, then /profiles/login_successful.
 * @param {'signin_with'|'signup_with'|'continue_with'|'signin'} [text]
 */
const SocialLogin = ({ redirectTo, text = 'continue_with' } = {}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { updateAuthState } = useContext(AuthContext);
  const [error, setError] = useState(null);

  const handleCredentialResponse = useCallback(
    async (response) => {
      setError(null);

      try {
        const storedUser = getUserFromLocalStorage();
        const wasAuthenticated = isAuthenticated();
        const hadAccessToken = getAccessTokenFromLocalStorage() !== null;
        const hadPreviousSession =
          storedUser !== null || wasAuthenticated || hadAccessToken;

        const data = await socialLogin(response.credential);

        if (!data || !data.id || !data.username || !data.email) {
          console.error('Invalid user data structure:', data);
          throw new Error('Invalid user data received from server');
        }

        if (hadPreviousSession) {
          sessionStorage.setItem('had_previous_session', 'true');
        }

        updateAuthState(data, data.access_token);
        const dest =
          redirectTo ||
          getAuthNextPath(searchParams, location.state) ||
          '/profiles/login_successful';
        navigate(dest);
      } catch (err) {
        console.error('Google login failed:', err);
        setError(err.message || 'Failed to login with Google');
      }
    },
    [updateAuthState, navigate, redirectTo, searchParams, location.state]
  );

  return (
    <SocialLoginContainer>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <GoogleLogin
        onSuccess={handleCredentialResponse}
        onError={(err) => {
          console.error('Google OAuth error:', err);
          setError('Failed to initialize Google login');
        }}
        theme="filled_blue"
        shape="rectangular"
        text={text}
        locale="es"
      />
    </SocialLoginContainer>
  );
};

export default SocialLogin;
