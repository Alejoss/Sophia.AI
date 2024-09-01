import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setAccessToken } from '../api/axios';  // Updated import path
import { fetchUserData } from './authSlice';
import { unwrapResult } from '@reduxjs/toolkit';
import Cookies from 'js-cookie';

const TokenHandler = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    const token = Cookies.get('jwt');

    if (token) {
      setAccessToken(token);
      
      dispatch(fetchUserData() as any)
        .then(unwrapResult)
        .then(() => {
          navigate('/profiles/profile_data');
        })
        .catch(() => {
          navigate('/profiles/login');
        });
    } else {
      navigate('/profiles/login');
    }
  }, [navigate, dispatch]);

  return <div>Loading...</div>;
};

export default TokenHandler;
