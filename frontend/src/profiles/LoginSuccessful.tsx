import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { fetchUserData } from './authSlice';
import { unwrapResult } from '@reduxjs/toolkit';

const LoginSuccessful = () => {
  console.log("Login Successful");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    console.log('LoginSuccessful component loaded');
    dispatch(fetchUserData() as any)
      .then(unwrapResult)
      .then(() => {
        navigate('/profile');  // Assuming '/profile' is the route for the user profile
      })
      .catch((error) => {
        console.error('Failed to fetch user data:', error);
        // Handle error, possibly redirect to login or error page
        navigate('/login');
      });
  }, [dispatch, navigate]);

  return <div>Loading your profile...</div>;
};

export default LoginSuccessful;
