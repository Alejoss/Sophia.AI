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