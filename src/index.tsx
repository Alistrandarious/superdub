import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import Diet from './Diet';
import Tasks from './Tasks';
import Profile from './Profile';
import Habits from './Habits';
import About from './About';
import MacroAnalysis from './MacroAnalysis';
import PrivacyPolicy from './PrivacyPolicy';
import LevelPage from './LevelPage';
import BottomNav from './BottomNav';
import { Auth } from './Auth';
import { isLoggedIn, clearToken } from './api';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';

const NO_NAV_PATHS = ['/privacy'];

function AppRouter() {
  const [authed, setAuthed] = useState(isLoggedIn());
  const location = useLocation();

  const handleLogout = () => {
    clearToken();
    setAuthed(false);
  };

  if (NO_NAV_PATHS.includes(location.pathname)) {
    return <PrivacyPolicy />;
  }

  if (!authed) {
    return <Auth onAuth={() => setAuthed(true)} />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Habits />} />
        <Route path="/dashboard" element={<App onLogout={handleLogout} />} />
        <Route path="/diet" element={<Diet />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/profile" element={<Profile onLogout={handleLogout} />} />
        <Route path="/about" element={<About />} />
        <Route path="/diet/macro" element={<MacroAnalysis />} />
        <Route path="/level" element={<LevelPage />} />
      </Routes>
      <BottomNav />
    </>
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
