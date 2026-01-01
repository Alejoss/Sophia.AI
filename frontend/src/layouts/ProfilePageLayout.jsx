import HeaderComp from '../generalComponents/HeaderComp.jsx';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';

const ProfilePageLayout = () => {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <HeaderComp />
      <Box component="main" sx={{ 
        flex: 1, 
        paddingTop: '120px',
        width: '100%',
        backgroundColor: 'background.default'
      }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default ProfilePageLayout; 