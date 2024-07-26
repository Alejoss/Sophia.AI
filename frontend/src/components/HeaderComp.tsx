import { Link } from 'react-router-dom';
import '/src/styles/header.css';
import '/src/styles/dropdown.css';


const HeaderComp = () => {
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
        <li className="nav-item">
          <a className="nav-link" href="/profiles/profile_data">Profile</a>
        </li>
        <li className="nav-item">
          <a className="nav-link" href="http://127.0.0.1:8000/content/libraries/user_library">Your Library</a>
        </li>
        <li className="nav-item dropdown">
          <span className="nav-link dropdown-toggle" id="navbarDropdown" role="button" aria-haspopup="true" aria-expanded="false">
            Profile
          </span>
          <div className="dropdown-menu" aria-labelledby="navbarDropdown">
            <Link className="dropdown-item" to="/profiles/login">Iniciar sesión</Link>
            <Link className="dropdown-item" to="/profiles/logout">Cerrar sesión</Link>
            <Link className="dropdown-item" to="/profiles/register">Registrar</Link>
          </div>
        </li>
      </ul>
    </nav>
  );
}

export default HeaderComp;
