// src/App.tsx
import React from 'react';
import HomeLayout from './layouts/HomeLayout.jsx'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProfileDetail from './profiles/ProfileDetail.jsx';
import ProfilesLayout from './layouts/ProfileLayout.jsx'
import ProfileData from './profiles/ProfileData.jsx'
import Bookmarks from './profiles/Bookmarks.jsx'
import Certificates from './profiles/Certificates.jsx'
import Events from './profiles/Events.jsx'
import PersonalLibrary from './profiles/PersonalLibrary.jsx'
import Security from './profiles/security.jsx'
import About from './profiles/About.jsx'
import Login from './profiles/Login.jsx'
import LoginSuccessful from './profiles/LoginSuccessful.jsx'
import Logout from './profiles/Logout.jsx'

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
       <Route path="/" element={<HomeLayout/>} />

       <Route path="/profiles" element={<ProfilesLayout/>}>
            <Route path="login" element={<Login />} />
            <Route path="login_successful" element={<LoginSuccessful/>} />
            <Route path="logout" element={<Logout/>} />
            <Route path="profile_certificates" element={<Certificates/>} />
            <Route path="profile_data" element={<ProfileData/>} />
            <Route path="profile_events" element={<Events/>} />
            <Route path="profile_bookmarks" element={<Bookmarks/>} />
            <Route path="profile_content" element={<PersonalLibrary/>} />
            <Route path="security" element={<Security/>} />
            <Route path="user_profile/:profileId" element={<ProfileDetail />} />
       </Route >

       <Route path="/courses" element={<HomeLayout/>}>
            <Route path="about" element={<About/>} />
       </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
