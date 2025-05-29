import { useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GoogleOAuthInitializer = ({ children }) => {
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;

  useEffect(() => {
    // Load the Google OAuth script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      document.head.removeChild(script);
    };
  }, []);

  if (!clientId) {
    console.error('Google OAuth Client ID is not defined in environment variables');
    return null;
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      {children}
    </GoogleOAuthProvider>
  );
};

export default GoogleOAuthInitializer; 