// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EventsList from './features/events/EventsList';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<EventsList />} />
        {/* More routes can be added here */}
      </Routes>
    </Router>
  );
};

export default App;
