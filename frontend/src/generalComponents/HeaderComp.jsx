import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import '../styles/header.css';
import '../styles/dropdown.css';

const HeaderComp = () => {
  const { authState } = useContext(AuthContext);
  const { isAuthenticated, user } = authState;

  return (
    <nav className="nav">
      <ul className="nav-list">
        <li className="nav-item">
          <Link className="nav-link" to="/search">Search</Link>
        </li>
        <li className="nav-item">
          <Link className="nav-link" to="/knowledge_path">Knowledge Paths</Link>
        </li>
        <li className="nav-item">
          <Link className="nav-link" to="/content/topics">Topics</Link>
        </li>
        <li className="nav-item">
          <Link className="nav-link" to="/events">Events</Link>
        </li>
        {isAuthenticated ? (
            <>
              <li className="nav-item">
                <Link className="nav-link" to="/profiles/my_profile">{user.username}</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/profiles/logout">Logout</Link>
              </li>
            </>
        ) : (
            <>
              <li className="nav-item">
                <Link className="nav-link" to="/profiles/login">Iniciar sesión</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/profiles/register">Register</Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}

export default HeaderComp;
