import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import axiosInstance from '../api/axios_config.js';
import { setCsrfToken } from '../api/profilesApi.js';
import { useDispatch } from 'react-redux';
import '../styles/login.css';

const Login = () => {
    const [credentials, setCredentials] = useState({ username: '', password: '' });
    const navigate = useNavigate();
    const dispatch = useDispatch();

    useEffect(() => {
        const initializeCsrf = () => {
            setCsrfToken().then(() => {
                console.log('CSRF token on Login load:', axiosInstance.defaults.headers.common['X-CSRFToken']);
            });
        };

        const checkIfLoggedIn = async () => {
            try {
                const response = await axiosInstance.get('/profiles/check_auth/');
                // Redirect to profile data page if user is already authenticated
                console.log('Check auth response:', response);
                if (response.status === 200 && response.data.is_authenticated) {
                    navigate('/profiles/profile_data');
                }
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    if (error.response && error.response.status === 401) {
                        console.log('User is not authenticated:', error.response.data);
                        // Handle the 401 error (e.g., show a message or redirect to login)
                    } else {
                        console.error('Error checking authentication status:', error);
                    }
                } else {
                    console.error('Unexpected error:', error);
                }
            }
        };

        initializeCsrf();
        checkIfLoggedIn();
    }, [navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCredentials({ ...credentials, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('CSRF token on submit:', axiosInstance.defaults.headers.common['X-CSRFToken']);
        try {
            const response = await axiosInstance.post('/profiles/login/', {
                username: credentials.username,
                password: credentials.password
            }, {
                headers: {
                    'X-CSRFToken': axiosInstance.defaults.headers.common['X-CSRFToken']
                }
            });
            if (response.status === 200) {
                await dispatch(fetchUserData());
                navigate('/profiles/login_successful'); // Navigate based on successful login
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Login failed:', error.response?.data);
                alert('Login FAILED CHECK LOGS: ' + error.response?.data);
            } else {
                console.error('Unexpected error:', error);
            }
        }
    };

    const logCsrfToken = () => {
        console.log('CSRF token:', axiosInstance.defaults.headers.common['X-CSRFToken']);
    };

    const handleGoogleLogin = () => {
        // Redirect the user to the Google OAuth endpoint
        window.location.href = 'http://localhost:8000/accounts/google/login/';
    };

    return (
        <div className="login-container">
            <h2>Login</h2>
            <button type="button" onClick={logCsrfToken}>Log CSRF Token</button>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Username:</label>
                    <input
                        type="text"
                        name="username"
                        value={credentials.username}
                        onChange={handleChange}
                    />
                </div>
                <div>
                    <label>Password:</label>
                    <input
                        type="password"
                        name="password"
                        value={credentials.password}
                        onChange={handleChange}
                    />
                </div>
                <button type="submit">Login</button>
            </form>
            <button onClick={handleGoogleLogin} className="google-login-button">
                Login with Google
            </button>
        </div>
    );
};

export default Login;
