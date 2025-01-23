import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios_config.js';
import { useSelector } from 'react-redux';
import '/src/styles/header.css';
import '/src/styles/dropdown.css';

const HeaderComp = () => {
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);

  // Log the auth slice state
  console.log('isAuthenticated:', isAuthenticated);
  console.log('user:', user);
  // TODO no refleja el estado de autenticación correctamente

  const handleLogout = async () => {
    try {
      await axiosInstance.post('/profiles/logout/');
      navigate('/profiles/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="nav">
      <ul className="nav-list">
        <li className="nav-item">
          <a className="nav-link" href="/courses/about">Academia Blockchain</a>
        </li>
        <li className="nav-item">
          <a className="nav-link" href="http://127.0.0.1:8000/">Courses</a>
        </li>
        <li className="nav-item">
          <a className="nav-link" href="http://127.0.0.1:8000/content/libraries/">Libraries</a>
        </li>
        {isAuthenticated && user && (
            <>
              <li className="nav-item">
                <a className="nav-link" href="/profiles/profile_data">{user.user.username}</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="http://127.0.0.1:8000/content/libraries/user_library">Your Library</a>
              </li>
              <li className="nav-item dropdown">
              <span className="nav-link dropdown-toggle" id="navbarDropdown" role="button" aria-haspopup="true"
                    aria-expanded="false">
                {user.user.username}
              </span>

              </li>
            </>
        )}
        <div className="nav-item">
          <span className="nav-link" onClick={handleLogout}>Cerrar sesión</span>
        </div>
        {!isAuthenticated && (
            <>
              <li className="nav-item">
                <Link className="nav-link" to="/profiles/login">Iniciar sesión</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/profiles/register">Registrar</Link>
              </li>
            </>
        )}
      </ul>
    </nav>
  );
}

export default HeaderComp;
