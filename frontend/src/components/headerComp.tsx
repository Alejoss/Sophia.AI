import React, { useContext, useEffect } from 'react';
import '../header.css';


const HeaderComp = () => {


  return (
      <>
    <nav className="nav">
      <ul className="nav-list">
        <li className="nav-item"><a className="nav-link" href="/courses/about">Academia Blockchain</a></li>


            <li className="nav-item"><a className="nav-link" href="http://127.0.0.1:8000/">Courses</a></li>
            <li className="nav-item"><a className="nav-link" href="http://127.0.0.1:8000/content/libraries/">Libraries</a></li>
            <li className="nav-item"><a className="nav-link" href="/profiles/profile_data">Profile</a></li>
            <li className="nav-item"><a className="nav-link" href="http://127.0.0.1:8000/content/libraries/user_library">Your Library</a></li>
            <li className="nav-item"><a className="nav-link" href="/courses/about">Sign in</a></li>








     </ul>
    </nav>
    </>
  );
}

export default HeaderComp;