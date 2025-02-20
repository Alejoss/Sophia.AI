import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import '/src/styles/header.css';
import '/src/styles/dropdown.css';

const HeaderComp = () => {
  const { authState } = useContext(AuthContext);
  const { isAuthenticated, user } = authState;
  console.log("isAuthenticated in header component:");
  console.log(isAuthenticated);

  return (
    <nav className="nav">
      <ul className="nav-list">
        <li className="nav-item">
          <Link className="nav-link" to="/knowledge_path">Knowledge Paths</Link>
        </li>
        <li className="nav-item">
          <Link className="nav-link" to="/knowledge_path/create">Create Knowledge Path</Link>
        </li>
        <li className="nav-item">
          <Link className="nav-link" to="/content/topics">Topics</Link>
        </li>
        {isAuthenticated ? (
            <>
              <li className="nav-item">
                <a className="nav-link" href="/content/library_user">Tu Librería</a>
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
