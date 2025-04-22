import HeaderComp from '../generalComponents/HeaderComp.jsx';
import { Outlet } from 'react-router-dom';
import '/src/styles/layout.css';

const MainLayout = () => {
  return (
    <div className="main-layout">
      <HeaderComp/>
      <main className="main-content">
        <Outlet/>
      </main>
    </div>
  )
}

export default MainLayout
