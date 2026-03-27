import { useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GoogleOAuthInitializer = ({ children }) => {
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return undefined;

    // Load the Google OAuth script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [clientId]);

  if (!clientId) {
    console.error('Google OAuth Client ID is not defined in environment variables');
    return (
      <>
        <div
          style={{
            margin: '0 0 12px 0',
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: '#fff3cd',
            color: '#664d03',
            border: '1px solid #ffecb5',
            fontSize: '0.95rem',
          }}
        >
          El inicio de sesion con Google no esta disponible temporalmente.
        </div>
        {children}
      </>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      {children}
    </GoogleOAuthProvider>
  );
};

export default GoogleOAuthInitializer; 