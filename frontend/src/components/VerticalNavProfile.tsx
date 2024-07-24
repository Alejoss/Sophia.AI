import React from 'react';
import { Link } from 'react-router-dom';
import '/src/styles/VerticalMenu.css';

const VerticalMenu: React.FC = () => {
  return (
    <div className="vertical-menu">
      <h1>Your Profile</h1>
      <ul>
        <li>
          <Link to="/Profiles/profile_certificates">Certificates</Link>
        </li>
        <li>
          <Link to="/Profiles/profile_data">Profile Data</Link>
        </li>
        <li>
          <Link to="/Profiles/profile_events">Courses and Events</Link>
        </li>
        <li>
          <Link to="/Profiles/profile_bookmarks">Bookmarks</Link>
        </li>
         <li>
          <Link to="/Profiles/profile_content">Personal Library</Link>
        </li>
         <li>
          <Link to="/Profiles/security">Security</Link>
        </li>
      </ul>
    </div>
  );
};

export default VerticalMenu;