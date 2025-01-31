import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import FormProvider from './context/FormContext.jsx';

import Home from './components/Home';
import HomeLayout from './layouts/HomeLayout.jsx';
import ProfileDetail from './profiles/ProfileDetail.jsx';
import ProfilesLayout from './layouts/ProfileLayout.jsx';
import ProfileData from './profiles/ProfileData.jsx';
import Bookmarks from './profiles/Bookmarks.jsx';
import Certificates from './profiles/Certificates.jsx';
import Events from './profiles/Events.jsx';
import PersonalLibrary from './profiles/PersonalLibrary.jsx';
import Security from './profiles/Security.jsx';
import About from './profiles/About.jsx';
import Login from './profiles/Login.jsx';
import LoginSuccessful from './profiles/LoginSuccessful.jsx';
import Logout from './profiles/Logout.jsx';
import CreateContentStepOne from './content/CreateContentStepOne.jsx';
import CreateContentStepTwo from './content/CreateContentStepTwo.jsx';


const App = () => {
  return (
    <AuthProvider>
    <FormProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/profiles" element={<ProfilesLayout />}>
          <Route path="login" element={<Login />} />
          <Route path="login_successful" element={<LoginSuccessful />} />
          <Route path="logout" element={<Logout />} />
          <Route path="profile_certificates" element={<Certificates />} />
          <Route path="profile_data" element={<ProfileData />} />
          <Route path="profile_events" element={<Events />} />
          <Route path="profile_bookmarks" element={<Bookmarks />} />
          <Route path="profile_content" element={<PersonalLibrary />} />
          <Route path="security" element={<Security />} />
          <Route path="user_profile/:profileId" element={<ProfileDetail />} />
        </Route>
        <Route path="content">
            <Route path="create_content_step_one" element={<CreateContentStepOne />}/>
            <Route path="create_content_step_two" element={<CreateContentStepTwo />}/>
        </Route>
      </Routes>
    </BrowserRouter>
    </FormProvider>
    </AuthProvider>
  );
};

export default App;
