// src/App.tsx
import React from 'react';
import HomeLayout from './layouts/HomeLayout'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EventDetail from './events/EventDetail';
import ProfileDetail from './profiles/ProfileDetail';
import ProfilesLayout from './layouts/ProfileLayout.tsx'
import ProfileData from './profiles/ProfileData.tsx'
import Bookmarks from './profiles/Bookmarks.tsx'
import Certificates from './profiles/Certificates.tsx'
import Events from './profiles/Events.tsx'
import PersonalLibrary from './profiles/PersonalLibrary.tsx'
import Security from './profiles/security.tsx'
import About from './profiles/About.tsx'
import Login from './profiles/Login.tsx'
import TokenHandler from './profiles/LoginSuccessful.tsx'

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
       <Route path="/" element={<HomeLayout/>} />

       <Route path="/events/:eventId" element={<EventDetail />} />

       <Route path="/profiles/:profileId" element={<ProfileDetail />} />

       <Route path="/profiles" element={<ProfilesLayout/>}>
            <Route path="login" element={<Login />} />
            <Route path="profile_certificates" element={<Certificates/>} />
            <Route path="profile_data" element={<ProfileData/>} />
            <Route path="profile_events" element={<Events/>} />
            <Route path="profile_bookmarks" element={<Bookmarks/>} />
            <Route path="profile_content" element={<PersonalLibrary/>} />
            <Route path="security" element={<Security/>} />
            <Route path="token_handler" element={<TokenHandler/>} />
       </Route >

       <Route path="/courses" element={<HomeLayout/>}>
            <Route path="about" element={<About/>} />
       </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
