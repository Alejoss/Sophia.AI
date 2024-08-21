import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TokenHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Retrieve the JWT token from the cookie (or URL if using that approach)
    const token = document.cookie.split('jwt=')[1];
    console.log("token:");
    console.log(token);

    if (token) {
      // Save the token as needed (e.g., in localStorage or context)
      localStorage.setItem('access_token', token);

      // Redirect to the desired route
      navigate('/profiles/profile_data');
    } else {
      // Handle the error or redirect to login if no token is found
      navigate('/profiles/login');
    }
  }, [navigate]);

  return <div>Loading...</div>;
};

export default TokenHandler;
