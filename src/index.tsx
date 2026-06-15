import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import Diet from './Diet';
import Tasks from './Tasks';
import Profile from './Profile';
import { Auth } from './Auth';
import { isLoggedIn, clearToken } from './api';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function Root() {
  const [authed, setAuthed] = useState(isLoggedIn());

  const handleLogout = () => {
    clearToken();
    setAuthed(false);
  };

  if (!authed) {
    return <Auth onAuth={() => setAuthed(true)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App onLogout={handleLogout} />} />
        <Route path="/diet" element={<Diet />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/profile" element={<Profile onLogout={handleLogout} />} />
      </Routes>
    </BrowserRouter>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
