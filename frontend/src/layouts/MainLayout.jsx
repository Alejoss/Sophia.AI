import HeaderComp from '../generalComponents/HeaderComp.jsx';

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
