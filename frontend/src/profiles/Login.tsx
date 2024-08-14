import React from 'react';

const Login: React.FC = () => {
  const handleGoogleLogin = () => {
    // Redirect the user to the Google OAuth endpoint
    window.location.href = 'http://localhost:8000/accounts/google/login/';
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      <button onClick={handleGoogleLogin} className="google-login-button">
        Login with Google
      </button>
    </div>
  );
};

export default Login;
