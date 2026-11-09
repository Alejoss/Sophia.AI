import HeaderComp from '../generalComponents/HeaderComp.jsx';
import { Outlet, useLocation } from 'react-router-dom';
import '/src/styles/layout.css';

const MainLayout = () => {
  const { pathname } = useLocation();
  // The inbox is a viewport-locked app, not a document. The default main
  // column is taller than the screen (header offset + extra gap), which
  // makes the page scroll at the same time as the message list.
  const lockViewport = pathname === '/messages' || pathname.startsWith('/messages/');

  return (
    <div className={lockViewport ? 'main-layout main-layout--locked' : 'main-layout'}>
      <HeaderComp/>
      <main className={lockViewport ? 'main-content main-content--locked' : 'main-content'}>
        <Outlet/>
      </main>
    </div>
  )
}

export default MainLayout
