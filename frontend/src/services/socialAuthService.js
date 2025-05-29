import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export const socialAuthService = {
    google: {
        init: () => {
            // Initialize Google OAuth
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        },
        login: async (credential) => {
            try {
                // Get CSRF token from cookie
                const csrfToken = document.cookie
                    .split('; ')
                    .find(row => row.startsWith('csrftoken='))
                    ?.split('=')[1];
                
                console.log('CSRF Token in service:', csrfToken);

                const response = await axios.post(
                    `${API_URL}/rest-auth/google/login/`,
                    { access_token: credential },
                    { 
                        withCredentials: true,
                        headers: {
                            'X-CSRFToken': csrfToken,
                            'Content-Type': 'application/json',
                        }
                    }
                );
                // Check if response has required user data
                if (!response.data || !response.data.user) {
                    throw new Error('Authentication failed: Invalid user data received');
                }

                return response.data;
            } catch (error) {
                console.error('Social auth service error:', error);
                // Enhance error message for better user feedback
                if (error.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    throw new Error(`Authentication failed: ${error.response.data?.error || error.response.statusText}`);
                } else if (error.request) {
                    // The request was made but no response was received
                    throw new Error('Authentication failed: No response from server');
                } else {
                    // Something happened in setting up the request that triggered an Error
                    throw new Error(`Authentication failed: ${error.message}`);
                }
            }
        }
    },
    // Easy to add more providers
    facebook: {
        init: () => {
            // Initialize Facebook SDK
        },
        login: async () => {
            // Facebook login implementation
        }
    },
    linkedin: {
        init: () => {
            // Initialize LinkedIn SDK
        },
        login: async () => {
            // LinkedIn login implementation
        }
    }
}; 