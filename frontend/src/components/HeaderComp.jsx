import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import '/src/styles/header.css';
import '/src/styles/dropdown.css';

const HeaderComp = () => {
  const { authState } = useContext(AuthContext);
  const { isAuthenticated, user } = authState;

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
        {isAuthenticated ? (
            <>
              <li className="nav-item">
                <a className="nav-link" href="/profiles/profile_library">Your Library</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/content/create_content_step_one">Crear Contenido</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/profiles/profile_data">{user.username}</a>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/profiles/logout">Cerrar sesión</Link>
              </li>
            </>
        ) : (
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
