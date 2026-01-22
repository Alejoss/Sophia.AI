import { useCallback, useContext, useEffect, useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { socialLogin } from '../api/profilesApi';
import { GoogleLogin } from '@react-oauth/google';
import { getUserFromLocalStorage, isAuthenticated, getAccessTokenFromLocalStorage } from '../context/localStorageUtils';

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
 * Social Login Component
 * Handles Google OAuth login
 */
const SocialLogin = () => {
    const navigate = useNavigate();
    const { updateAuthState } = useContext(AuthContext);
    const [error, setError] = useState(null);

    const handleCredentialResponse = useCallback(async (response) => {
        console.log('Google OAuth response received:', response);
        setError(null);

        try {
            // Check if user had previous session data before login using utilities
            const storedUser = getUserFromLocalStorage();
            const wasAuthenticated = isAuthenticated();
            const hadAccessToken = getAccessTokenFromLocalStorage() !== null;
            const hadPreviousSession = (storedUser !== null) || wasAuthenticated || hadAccessToken;
            
            console.log('Attempting to login with Google credential...');
            const data = await socialLogin(response.credential);
            console.log('Social login successful, raw response data:', data);
            
            if (!data || !data.id || !data.username || !data.email) {
                console.error('Invalid user data structure:', data);
                throw new Error('Invalid user data received from server');
            }
            
            // Mark if this is a returning user
            if (hadPreviousSession) {
                sessionStorage.setItem('had_previous_session', 'true');
            }
            
            updateAuthState(data, data.access_token);
            navigate('/profiles/login_successful');
        } catch (error) {
            console.error('Google login failed:', error);
            setError(error.message || 'Failed to login with Google');
        }
    }, [updateAuthState, navigate]);

    return (
        <SocialLoginContainer>
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <GoogleLogin
                onSuccess={handleCredentialResponse}
                onError={(error) => {
                    console.error('Google OAuth error:', error);
                    setError('Failed to initialize Google login');
                }}
                theme="filled_blue"
                shape="rectangular"
                text="continue_with"
                locale="en"
            />
        </SocialLoginContainer>
    );
};

export default SocialLogin; 