import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from 'axios';
import { setCsrfToken } from '../api/profilesApi.ts'


const Login = () => {
    const [credentials, setCredentials] = useState({username: '', password: ''});
    const navigate = useNavigate();

    useEffect(() => {
        const initializeCsrf = () => {
            setCsrfToken().then(() => {
                console.log('CSRF token on Login load:', axiosInstance.defaults.headers.common['X-CSRFToken']);
            });
        };
        initializeCsrf();
    }, []);

    const handleChange = (e) => {
        const {name, value} = e.target;
        setCredentials({...credentials, [name]: value});
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('CSRF token on submit:', axiosInstance.defaults.headers.common['X-CSRFToken']);
        try {
            const response = await axiosInstance.post('http://localhost:8000/profiles/login/', credentials);
            if (response.status === 302) {
                navigate('/profiles/login_successful'); // Navigate based on successful login
            }
        } catch (error) {
            console.error('Login failed:', error.response.data);
            alert('Login failed: ' + error.response.data.error);
        }
    };

    const logCsrfToken = () => {
        console.log('CSRF token:', axiosInstance.defaults.headers.common['X-CSRFToken']);
    };
    // TODO el token no esta en el header.

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

