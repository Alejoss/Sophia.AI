import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import '../styles/header.css';
import '../styles/dropdown.css';
import  { useState } from "react";

const HeaderComp = () => {
  const { authState } = useContext(AuthContext);
  const { isAuthenticated, user } = authState;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="nav">
      <div className='flex items-center justify-between w-full max-w-[1200px] px-5 mx-auto'>
        <Link href="/" className="block"><img src="/images/logo.png" className='lg:h-7 h-4' alt="" /></Link>
    <ul
        className={`nav-list lg:!flex ${
          isOpen ? "!block" : "!hidden"
        } flex-col lg:flex-row lg:static absolute top-20 left-0 w-full lg:p-0 px-[30px] lg:shadow-none shadow-2xl lg:bg-transparent bg-white`}
      >
        <li className="nav-item">
          <Link className="nav-link" to="/search">
            Search
          </Link>
        </li>
        <li className="nav-item">
          <Link className="nav-link" to="/knowledge_path">
            Knowledge Paths
          </Link>
        </li>
        <li className="nav-item">
          <Link className="nav-link" to="/content/topics">
            Topics
          </Link>
        </li>
        <li className="nav-item">
          <Link className="nav-link" to="/events">
            Events
          </Link>
        </li>

        {isAuthenticated ? (
          <>
            <li className="nav-item">
              <Link className="nav-link" to="/profiles/my_profile">
                {user.username}
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/profiles/logout">
                Logout
              </Link>
            </li>
          </>
        ) : (
          <>
            <li className="nav-item">
              <Link className="nav-link" to="/profiles/login">
                Iniciar sesión
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/profiles/register">
                Register
              </Link>
            </li>
          </>
        )}
      </ul>
       <button
        type="button"
        className="block h-6 w-6 lg:!hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        <img
          src="/images/hamburger.svg"
          className="w-6 h-6"
          alt="Menu"
        />
      </button>
       </div>
    </nav>
  );
}

export default HeaderComp;
