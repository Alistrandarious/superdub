import React, { useState, useEffect, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Habits from './Habits';
import DailyCheckIn from './DailyCheckIn';
import ComebackPrompt from './ComebackPrompt';
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
import { LapseProvider } from './LapseBanner';
import LevelUpCelebration from './LevelUpCelebration';
import DubChat from './DubChat';
import TrendSheet from './TrendSheet';
import BackgroundApplier from './BackgroundApplier';
import NightSky from './NightSky';
import ConsentGate from './ConsentGate';
import { initAnalytics, analyticsConfigured } from './analytics';
import { analyticsConsent } from './consent';

// Start analytics on load. No-ops unless a key is configured AND consent was
// granted, so on a keyless build (today) this does nothing.
initAnalytics();

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
const StagesPreview = lazy(() => import('./StagesPreview'));

const NO_NAV_PATHS = ['/privacy'];

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function AppRouter() {
  const [authed, setAuthed] = useState(isLoggedIn());
  // Existing users get a single full-screen analytics notice; new users accept
  // during signup, so they never see it. Only shown on builds that actually have
  // analytics configured, and only when the user has not been asked before.
  const [needConsent, setNeedConsent] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (authed && analyticsConfigured() && analyticsConsent() === null) setNeedConsent(true);
  }, [authed]);

  const handleLogout = () => {
    clearToken();
    setAuthed(false);
  };

  // The 90-day token expires eventually. api.ts clears it on any 401 and fires
  // this, so an expired session lands on the sign-in screen instead of leaving
  // every panel silently empty.
  useEffect(() => {
    const onExpired = () => setAuthed(false);
    window.addEventListener('superdub:auth-expired', onExpired);
    return () => window.removeEventListener('superdub:auth-expired', onExpired);
  }, []);

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

  // Bottom-fade lifter: the scroll fade hints "more below", so it lifts when a
  // scroller can't scroll or is at its end, and returns when you scroll up.
  // A scroll-only listener LATCHED fade-end wrong (a scroll event while content
  // was short/still loading marked the page "at bottom" forever, killing the
  // gradient), so a slow sweep re-evaluates every faded scroller as content
  // grows. ponytail: 1.5s polling over per-scroller ResizeObservers — a 5-element
  // querySelectorAll; upgrade if it ever shows in a profile.
  useEffect(() => {
    const SEL = '.habits-page-scroll, .tasks-content, .diet-content, .profile-content, .plan-page';
    const apply = (el: HTMLElement) => {
      const canScroll = el.scrollHeight > el.clientHeight + 4;
      el.classList.toggle('fade-end', !canScroll || el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
    };
    const onScroll = (e: Event) => {
      const el = e.target as HTMLElement;
      if (el?.classList && el.matches(SEL)) apply(el);
    };
    const sweep = () => document.querySelectorAll<HTMLElement>(SEL).forEach(apply);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', sweep);
    const timer = setInterval(sweep, 1500);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', sweep);
      clearInterval(timer);
    };
  }, []);

  // Deep-link from a push notification: ?prompt=weight|exercise|evening|comeback
  // opens the matching overlay (the SW lands us here). Strip the param so a refresh
  // won't repeat.
  useEffect(() => {
    if (!authed) return;
    const params = new URLSearchParams(location.search);
    const prompt = params.get('prompt');
    if (!prompt) return;
    const evt = prompt === 'exercise' ? 'superdub:show-exercise'
      : prompt === 'evening' ? 'superdub:show-evening'
      : prompt === 'weight' ? 'superdub:show-checkin'
      : prompt === 'comeback' ? 'superdub:show-comeback' : null;
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
      {/* The one <main> landmark, so screen-reader users can jump straight to the
          page content past the header/nav. A real flex box (not display:contents,
          which some screen readers drop from the a11y tree) so the landmark is
          guaranteed while the existing full-height layout is preserved. */}
      <main className="route-main">
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
        <Route path="/stages" element={<StagesPreview />} />
      </Routes>
      </Suspense>
      </main>
      {needConsent && <ConsentGate onDecided={() => setNeedConsent(false)} />}
      {/* First, and alone: someone back after a long gap gets one screen, not four. */}
      <ComebackPrompt />
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
        <LapseProvider>
        <BackgroundApplier />
        <NightSky />
        <UpdateBanner />
        <DayBanner />
        <AppRouter />
        <LevelUpCelebration />
        <DubChat />
        <TrendSheet />
        </LapseProvider>
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
