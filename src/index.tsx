import React, { useState, useEffect, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Habits from './Habits';
import DailyCheckIn from './DailyCheckIn';
import VitalsPrompt from './VitalsPrompt';
import ExercisePrompt from './ExercisePrompt';
import EveningPrompt from './EveningPrompt';
import GlobalPrompt from './GlobalPrompt';
import StepEntry from './StepEntry';
import WeightEntry from './WeightEntry';
import BottomNav from './BottomNav';
import UpdateBanner from './UpdateBanner';
import DayBanner from './DayBanner';
import { Auth } from './Auth';
import { isLoggedIn, clearToken, api } from './api';
import { initStepSync } from './stepSync';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { XPProvider } from './XPContext';
import LevelUpCelebration from './LevelUpCelebration';
import CoachReport from './CoachReport';
import BackgroundApplier from './BackgroundApplier';
import NightSky from './NightSky';

// Habits (home) stays eager for instant first paint; everything else splits
// into its own chunk so recharts etc. load only when the page is visited.
const App = lazy(() => import('./App'));
const Diet = lazy(() => import('./Diet'));
const Tasks = lazy(() => import('./Tasks'));
const Profile = lazy(() => import('./Profile'));
const DubPage = lazy(() => import('./DubPage'));
const About = lazy(() => import('./About'));
const PrivacyPolicy = lazy(() => import('./PrivacyPolicy'));
const MathsPage = lazy(() => import('./MathsPage'));
const LevelPage = lazy(() => import('./LevelPage'));
const ArchivedHabits = lazy(() => import('./ArchivedHabits'));
const PlanPage = lazy(() => import('./PlanPage'));
const CommunityPage = lazy(() => import('./CommunityPage'));

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

  // Bottom-fade lifter: the scroll fade hints "more below", so it should vanish
  // once a scroller actually reaches its end (and come back when you scroll up).
  // One delegated capture-phase listener covers every faded scroller in the app.
  // ponytail: containers that never fire a scroll (content fits) keep the fade;
  // fixing that needs a ResizeObserver per scroller — not worth it yet.
  useEffect(() => {
    const SEL = '.habits-page-scroll, .tasks-content, .diet-content, .profile-content, .cc-slide-viz, .plan-page';
    const onScroll = (e: Event) => {
      const el = e.target as HTMLElement;
      if (!el?.classList || !el.matches(SEL)) return;
      el.classList.toggle('fade-end', el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
    };
    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, []);

  // Deep-link from a push notification: ?prompt=weight|exercise opens the
  // matching overlay (the SW lands us here). Strip the param so a refresh
  // won't repeat.
  useEffect(() => {
    if (!authed) return;
    const params = new URLSearchParams(location.search);
    const prompt = params.get('prompt');
    if (!prompt) return;
    const evt = prompt === 'exercise' ? 'superdub:show-exercise'
      : prompt === 'evening' ? 'superdub:show-evening'
      : prompt === 'weight' ? 'superdub:show-checkin' : null;
    window.history.replaceState({}, '', location.pathname);
    // Defer so the overlay listeners (siblings mounted this same tick) are attached.
    if (evt) setTimeout(() => window.dispatchEvent(new CustomEvent(evt)), 80);
  }, [authed, location.search, location.pathname]);

  if (NO_NAV_PATHS.includes(location.pathname)) {
    return <Suspense fallback={null}><PrivacyPolicy /></Suspense>;
  }

  if (!authed) {
    return <Auth onAuth={() => setAuthed(true)} />;
  }

  return (
    <>
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Habits />} />
        <Route path="/dashboard" element={<App onLogout={handleLogout} />} />
        <Route path="/diet" element={<Diet />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/profile" element={<Profile onLogout={handleLogout} />} />
        <Route path="/dub" element={<DubPage />} />
        <Route path="/about" element={<About />} />
        <Route path="/maths" element={<MathsPage />} />
        <Route path="/level" element={<LevelPage />} />
        <Route path="/archived" element={<ArchivedHabits />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/community" element={<CommunityPage />} />
      </Routes>
      </Suspense>
      <DailyCheckIn />
      <VitalsPrompt />
      <ExercisePrompt />
      <EveningPrompt />
      <GlobalPrompt />
      <StepEntry />
      <WeightEntry />
      <BottomNav />
    </>
  );
}

function Root() {
  return (
    <BrowserRouter>
      <XPProvider>
        <BackgroundApplier />
        <NightSky />
        <UpdateBanner />
        <DayBanner />
        <AppRouter />
        <LevelUpCelebration />
        <CoachReport />
      </XPProvider>
    </BrowserRouter>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
