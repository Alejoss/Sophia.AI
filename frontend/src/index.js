import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom'; // Import BrowserRouter
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter> {/* Use BrowserRouter to wrap the App */}
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// The code for measuring performance can remain unchanged
reportWebVitals();
