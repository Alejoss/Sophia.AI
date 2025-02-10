import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';

import Home from './components/Home';
import MainLayout from './layouts/MainLayout.jsx';
import ProfileDetail from './profiles/ProfileDetail.jsx';
import ProfileData from './profiles/ProfileData.jsx';
import Bookmarks from './profiles/Bookmarks.jsx';
import Certificates from './profiles/Certificates.jsx';
import Events from './profiles/Events.jsx';
import PersonalLibrary from './profiles/PersonalLibrary.jsx';
import Login from './profiles/Login.jsx';
import LoginSuccessful from './profiles/LoginSuccessful.jsx';
import Logout from './profiles/Logout.jsx';
import UploadContentForm from './content/UploadContentForm.jsx';

const App = () => {
  return (
    <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="profiles">
            <Route path="login" element={<Login />} />
            <Route path="login_successful" element={<LoginSuccessful />} />
            <Route path="logout" element={<Logout />} />
            <Route path="profile_certificates" element={<Certificates />} />
            <Route path="profile_data" element={<ProfileData />} />
            <Route path="profile_events" element={<Events />} />
            <Route path="profile_bookmarks" element={<Bookmarks />} />
            <Route path="profile_content" element={<PersonalLibrary />} />          
            <Route path="user_profile/:profileId" element={<ProfileDetail />} />
          </Route>
          <Route path="content">
            <Route path="upload_content" element={<UploadContentForm />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
