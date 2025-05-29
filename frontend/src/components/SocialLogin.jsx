import { useCallback, useContext, useEffect, useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { socialAuthService } from '../services/socialAuthService';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';

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

const SocialLogin = () => {
    const navigate = useNavigate();
    const { setAuthState } = useContext(AuthContext);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Log CSRF token on mount
        const csrfToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1];
        console.log('CSRF Token on mount:', csrfToken);
    }, []);

    const handleCredentialResponse = useCallback(async (response) => {
        console.log('Google OAuth response received:', response);
        setError(null); // Clear any previous errors
        
        // Log CSRF token before making the request
        const csrfToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1];
        console.log('CSRF Token before request:', csrfToken);
        
        // Log all cookies for debugging
        console.log('All cookies:', document.cookie);

        try {
            console.log('Attempting to login with Google credential...');
            const data = await socialAuthService.google.login(response.credential);
            console.log('Social login successful, user data:', data);
            
            if (!data || !data.user) {
                throw new Error('Invalid user data received from server');
            }
            
            setAuthState({
                isAuthenticated: true,
                user: data.user
            });
            console.log('Auth state updated with user data');
            
            navigate('/profiles/login_successful');
            console.log('Redirecting to login success page');
        } catch (error) {
            console.error('Google login failed:', error);
            setError(error.message || 'Failed to login with Google');
            console.error('Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers
            });
        }
    }, [setAuthState, navigate]);

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