// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EventsList from './features/events/EventsList';
import EventDetail from './features/events/EventDetail';
import ProfileDetail from './features/profiles/ProfileDetail';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<EventsList />} />
        <Route path="/events/:eventId" element={<EventDetail />} />
       <Route path="/profiles/:profileId" element={<ProfileDetail />} />
      </Routes>
    </Router>
  );
};

export default App;
