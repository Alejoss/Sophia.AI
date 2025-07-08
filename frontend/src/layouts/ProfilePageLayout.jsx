import HeaderComp from '../generalComponents/HeaderComp.jsx';
import { Outlet } from 'react-router-dom';

const ProfilePageLayout = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <HeaderComp />
      <main style={{ 
        flex: 1, 
        paddingTop: '120px',
        width: '100%',
        backgroundColor: '#f5f5f5'
      }}>
        <Outlet />
      </main>
    </div>
  );
};

export default ProfilePageLayout; 