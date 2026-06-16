import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import Diet from './Diet';
import Tasks from './Tasks';
import Profile from './Profile';
import Habits from './Habits';
import About from './About';
import PrivacyPolicy from './PrivacyPolicy';
import { Auth } from './Auth';
import { isLoggedIn, clearToken } from './api';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';

function AppRouter() {
  const [authed, setAuthed] = useState(isLoggedIn());
  const location = useLocation();

  const handleLogout = () => {
    clearToken();
    setAuthed(false);
  };

  if (location.pathname === '/privacy') {
    return <PrivacyPolicy />;
  }

  if (!authed) {
    return <Auth onAuth={() => setAuthed(true)} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Habits />} />
      <Route path="/dashboard" element={<App onLogout={handleLogout} />} />
      <Route path="/diet" element={<Diet />} />
      <Route path="/tasks" element={<Tasks />} />
      <Route path="/profile" element={<Profile onLogout={handleLogout} />} />
      <Route path="/about" element={<About />} />
    </Routes>
  );
}

function Root() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
