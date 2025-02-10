import HeaderComp from '../components/HeaderComp.jsx';

import { Outlet } from 'react-router-dom';
const MainLayout = () => {
  return (
    <>
    <div>
        <HeaderComp/>
            <Outlet/>
        </div>
    </>
      )
}

export default MainLayout
