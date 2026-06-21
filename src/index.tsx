import React, { useState, useEffect } from 'react';
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
import FoodLog from './FoodLog';
import MealPlans from './MealPlans';
import PlanPage from './PlanPage';
import DailyCheckIn from './DailyCheckIn';
import StepEntry from './StepEntry';
import BottomNav from './BottomNav';
import { Auth } from './Auth';
import { isLoggedIn, clearToken, api } from './api';
import { initStepSync } from './stepSync';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';

const NO_NAV_PATHS = ['/privacy'];

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function AppRouter() {
  const [authed, setAuthed] = useState(isLoggedIn());
  const location = useLocation();

  const handleLogout = () => {
    clearToken();
    setAuthed(false);
  };

  // Keep last_active_at current: fire on mount, tab focus, and every 5 min
  useEffect(() => {
    if (!authed) return;

    const ping = () => api.heartbeat().catch(() => {});

    ping(); // immediate on app open / login

    initStepSync(); // native-only: pull phone steps on launch/resume (no-op on web)

    const onVisible = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVisible);

    const timer = setInterval(ping, HEARTBEAT_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [authed]);

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
        <Route path="/food-log" element={<FoodLog />} />
        <Route path="/meal-plans" element={<MealPlans />} />
        <Route path="/plan" element={<PlanPage />} />
      </Routes>
      <DailyCheckIn />
      <StepEntry />
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
