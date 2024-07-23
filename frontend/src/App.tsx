// src/App.tsx
import React from 'react';
import HomeLayout from './layouts/HomeLayout'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EventsList from './features/events/EventsList';
import EventDetail from './features/events/EventDetail';
import ProfileDetail from './features/profiles/ProfileDetail';
import ProfilesLayout from './layouts/ProfilesLayout'
import ProfileData from './paginas/profiles.tsx'
import Bookmarks from './paginas/bookmarks.tsx'
import Certificates from './paginas/certificates.tsx'
import Events from './paginas/events.tsx'
import PersonalLibrary from './paginas/personalibrary.tsx'
import Security from './paginas/security.tsx'
import About from './paginas/about.tsx'

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeLayout/>} />
        <Route path="/events/:eventId" element={<EventDetail />} />
       <Route path="/profiles/:profileId" element={<ProfileDetail />} />


       <Route path="/Profiles" element={<ProfilesLayout/>}>
            <Route path="profile_certificates" element={<Certificates/>} />
            <Route path="profile_data" element={<ProfileData/>} />
            <Route path="profile_events" element={<Events/>} />
            <Route path="profile_bookmarks" element={<Bookmarks/>} />
            <Route path="profile_content" element={<PersonalLibrary/>} />
            <Route path="security" element={<Security/>} />
       </Route >

       <Route path="/courses" element={<HomeLayout/>}>
            <Route path="about" element={<About/>} />
       </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
