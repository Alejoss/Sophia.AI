import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { resetAuthState } from '../redux/authSlice'; // Use the correct action
import { logout as apiLogout } from '../api/profilesApi'; // This assumes logout is exported from profilesApi

const Logout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const logoutUser = async () => {
      try {
        // Call backend logout endpoint
        await apiLogout();
        // Reset authentication state
        dispatch(resetAuthState());
        // Redirect to login or home page
        navigate('profiles/login');
      } catch (error) {
        console.error('Logout failed:', error);
      }
    };

    logoutUser();
  }, [dispatch, navigate]);

  return (
    <div>Logging out...</div>
  );
};

export default Logout;
