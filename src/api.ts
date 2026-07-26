import { makeCache } from './apiCache';
import { capture } from './analytics';

// Inside a Capacitor native shell the webview origin is capacitor://localhost, so the
// relative '/api' + CRA dev proxy don't apply — point at the hosted backend directly.
// We read the injected window.Capacitor global rather than importing @capacitor/core so
// the plain web/PWA build has no dependency on the native package.
export const isNative =
  typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.() === true;
const BASE = isNative ? 'https://superdub.onrender.com/api' : '/api';

export type StepSource = 'health_connect' | 'healthkit' | 'manual';
export interface StepEntry {
  day: string;
  source: StepSource;
  steps: number;
  active: boolean;
  recorded_at: string;
}

// ── Shared response shapes (mirrors server/routes/*.ts res.json(...) payloads) ──

/** GET /api/lapse — raw recency signals. `daysSinceLog` is null when they have
 *  never logged (JSON can't carry the Infinity the server derives). */
export interface LapseSignalsResponse {
  daysSinceLog: number | null;
  hadPriorActivity: boolean;
  daysSinceReturn: number | null;
  lastGapDays: number;
  weekMarks: number;
  weekDue: number;
  restoreAvailable: boolean;
}

/** GET /api/entitlement — mirrors EntitlementState in server/middleware/entitlement.ts. */
export interface EntitlementResponse {
  entitlement: 'free' | 'trial' | 'pro';
  trialEndsAt: string;
  /** How many of your own habits you may keep. null = no ceiling. */
  habitLimit: number | null;
  habitCount: number;
}

export interface SignupCohort {
  cohortName: string;
  cohortSize: number;
  baselineSteps: number;
  baselineCalories: number;
  onboardingMessage: string;
}

export interface ProfileResponse {
  name?: string;
  nickname?: string;
  dob?: string;
  heightCm?: string;
  weightKg?: string;
  sex?: string;
  activity?: string;
  steps?: string;
  vestKg?: string;
  jobType?: string;
  gymFreq?: string;
  walkFreq?: string;
  // ponytail: DB column is INTEGER, but a caller does parseInt(profile.stepTarget) —
  // typing this as number would break that call site (out of scope to fix), so it
  // stays untyped here rather than shipping a type that's wrong for how it's used.
  stepTarget?: any;
  gymSessionsPerWeek?: number;
  gymIntensity?: string;
  gymMinutes?: number;
  weeklyActivities?: unknown[];
  avatarSeed?: string | null;
  occupation?: string;
  ethnicity?: string;
  genderIdentity?: string;
  country?: string;
  relationshipStatus?: string;
  religion?: string;
  accountCreatedAt: string | null;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
}

export interface TrackerDayRow {
  day: string;
  weight: string;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
  steps: string;
}
export interface TrackerHabitRow {
  day: string;
  habit_name: string;
  // ponytail: server can send null (no state and not legacy-done) — narrowed to
  // string here because an existing caller (XPContext's computeXPFromRaw) already
  // types this param as plain string and only ever does `=== 'done'`, so the null
  // case behaves identically either way.
  state: 'done' | 'failed' | 'na' | string;
}
export interface TrackerResponse {
  days: TrackerDayRow[];
  habits: TrackerHabitRow[];
  xpCarry?: Record<string, number>;
  year?: number;
}

export interface WeightSettingsResponse {
  currentWeight?: string;
  goalWeight?: string;
  lossPerWeek?: string;
  timeDays?: string;
  height?: string;
  age?: string;
  activityLevel?: string;
}

export interface DietTargetResponse {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}
export interface DietSettingsResponse {
  lockProtein: boolean;
  lockCarbs: boolean;
  lockFats: boolean;
  calorieLock: boolean;
  goal: string;
}
export interface DietPlanRow {
  id: string;
  label: string;
  meals: unknown;
  totals: unknown;
}

export interface SmartGoal {
  id: string;
  title: string;
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timeBound: string;
  done: boolean;
}

export interface TaskRow {
  id: string;
  text: string;
  done: boolean;
  type: string;
  dueDate: string | null;
}

// TDEE/stall/goal shapes mirror server/services/{tdeeEstimator,plateauPredictor,planEngine}.ts
// (re-declared here rather than imported — api.ts is frontend-only and those are server modules).
export interface PlanTDEEEstimate {
  observedTDEE: number | null;
  blendedTDEE: number;
  formulaTDEE: number;
  confidence: number;
  intakeUsed: number;
  intakeIsLogged: boolean;
}
export interface PlanStallSignal {
  risk: 'none' | 'low' | 'medium' | 'high';
  score: number;
  message: string;
  factors: string[];
  action: string;
}
export interface PlanGoal {
  id: string;
  goalType: 'lose' | 'gain' | 'maintain';
  startWeight: number;
  startDate: string;
  targetWeight: number;
  targetDate: string;
  ratePctBw: number;
}
export interface PlanTargetHistoryEntry {
  id: string;
  calories: number;
  previousCalories: number | null;
  reason: string;
  effectiveFrom: string;
}
/** The plan the engine would write today, when the one you're on has stopped
 *  being reachable at a safe pace. Offered on the Plan page, never auto-applied.
 *  Mirrors ReplanProposal in server/services/replan.ts. */
export interface PlanReplanProposal {
  cause: 'unreachable' | 'date-passed';
  kgToGo: number;
  requiredRate: number;
  safeRate: number;
  weeksNeeded: number;
  newTargetDate: string;
  gapDays: number;
  headline: string;
}
export type PlanStatusResponse =
  | { active: false }
  | {
      active: true;
      tdee: PlanTDEEEstimate | null;
      stall: PlanStallSignal | null;
      replan: PlanReplanProposal | null;
      goal: PlanGoal;
      currentTarget: { calories: number; reason: string; effectiveFrom: string } | null;
      history: PlanTargetHistoryEntry[];
    };
export interface CreatePlanGoalResponse {
  ok: true;
  goalId: string;
  goalType: 'lose' | 'gain' | 'maintain';
  startWeight: number;
  initialCalories: number;
  bmrFloor: number;
  tdee: number;
  ratePctBw: number;
  rateKgPerWk: number;
}
export interface PlanCycleResponse {
  ran: boolean;
  reason?: string;
  currentCalories?: number;
  daysUntilNext?: number;
  adjusted?: boolean;
  newCalories?: number;
  prevCalories?: number;
  // ponytail: the server only sends onTrack/actualSlope/targetSlope/flaggedDays when
  // ran/adjusted actually happened (early-return branches like "next cycle in N days"
  // omit them) — kept non-optional here because an existing caller (PlanPage's
  // CycleData) already assumed they're always present; that pre-existing assumption
  // is unchanged by this typing pass.
  onTrack: boolean;
  actualSlope: number | null;
  targetSlope: number;
  flaggedDays: string[];
  bmrFloor?: number;
  metabolicProtection?: boolean;
  goalReached?: boolean;
  goalType?: 'lose' | 'gain' | 'maintain';
  targetWeight?: number;
  latestWeight?: number;
}
export interface ResolvePlanReachedResponse {
  ok: true;
  note?: string;
  switched?: 'maintain';
  dismissed?: boolean;
}

export type ChurnRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TrendStatus = 'ahead' | 'on-track' | 'behind' | 'none';

export interface RecentCheckInRow {
  date: string;
  energy: number | null;
  adherence: string | null;
  mood: number | null;
}
export interface RecentCheckInsResponse {
  checkins: RecentCheckInRow[];
  churnRisk: ChurnRisk;
  today: { energy: number; adherence: string | null } | null;
}
export interface CoachingResponse {
  message: string;
  churnRisk: ChurnRisk;
  trend: TrendStatus;
  todayEnergy: number | null;
  workoutCalories: number | null;
  advisableSteps: number;
}

function getToken() {
  return localStorage.getItem('superdub.token');
}

export function setToken(t: string) {
  localStorage.setItem('superdub.token', t);
  clearApiCaches(); // a new session must not read the previous user's cached data
}

export function clearToken() {
  localStorage.removeItem('superdub.token');
  clearApiCaches();
}

export function isLoggedIn() {
  return !!getToken();
}

/**
 * Why a request failed, so a screen can tell the user something true.
 * Every screen used to catch a bare Error and render its empty state, which
 * made "we could not reach the server" look identical to "you have nothing
 * here" — on a habit tracker that reads as lost data.
 */
export type ApiErrorKind = 'offline' | 'timeout' | 'auth' | 'server';

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
  /** True when retrying might work — i.e. we never reached the server. */
  get retryable() { return this.kind !== 'auth'; }
}

/** Human copy for a failed load. One place, so every screen says the same thing. */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.kind) {
      case 'offline': return "You're offline. Your saved data is safe.";
      case 'timeout': return 'The server took too long to answer.';
      case 'auth':    return 'Your session expired. Sign in again.';
      default:        return 'Something went wrong at our end.';
    }
  }
  return 'Something went wrong.';
}

// Render's free tier cold-starts, so a request can hang for a minute with no
// signal. 20s is past a normal cold start but short enough to still feel like
// an answer rather than a freeze.
const REQUEST_TIMEOUT_MS = 20_000;

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError('offline', 'No connection');
  }

  // Coarse endpoint label for telemetry: digits (ids) stripped so no user id or
  // date ever reaches analytics. e.g. /friends/42/nudge → /friends/:id/nudge.
  const ep = path.split('?')[0].replace(/\d+/g, ':id');

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch (e: any) {
    // fetch only rejects when the request never completed: abort or no network.
    if (e?.name === 'AbortError') {
      capture('api_error', { kind: 'timeout', path: ep });
      throw new ApiError('timeout', 'Request timed out');
    }
    throw new ApiError('offline', 'Could not reach the server');
  } finally {
    clearTimeout(timer);
  }

  // A 401 means the 90-day token expired. Drop it and tell the app, so the user
  // gets the sign-in screen instead of a page of silently empty panels.
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent('superdub:auth-expired'));
    throw new ApiError('auth', 'Session expired', 401);
  }

  // A gateway/proxy error is HTML, not JSON — parsing it would throw a
  // SyntaxError and lose the real status.
  let data: any = null;
  try { data = await res.json(); } catch { /* keep null, handled below */ }

  if (!res.ok) {
    capture('api_error', { kind: 'server', status: res.status, path: ep });
    throw new ApiError('server', data?.error ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

// ── Shared read caches (E2.2) ──────────────────────────────────────────────
// Plan status and profile are fetched independently by many components on mount
// (~10 and ~7 call sites). Caching the base getters dedupes a burst of mounts
// into one request; every mutation that can change either resource invalidates
// the relevant cache below, so callers still read fresh data after a write. The
// 60s TTL bounds staleness across a long session with no mutation. Auth changes
// (login/logout) clear both so one user never reads another's cached data.
const planStatusCache = makeCache<PlanStatusResponse>(() => request('/plan/status'), 60_000);
const profileCache = makeCache<ProfileResponse>(() => request('/profile'), 60_000);
export function clearApiCaches() { planStatusCache.invalidate(); profileCache.invalidate(); }

export const api = {
  // auth
  signup: (body: object): Promise<{ token: string; userId: number; cohort: SignupCohort }> =>
    request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: object): Promise<{ token: string; userId: number }> =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: (): Promise<{ profile: Record<string, unknown> | null; habits: string[]; weightSettings: Record<string, unknown> | null }> =>
    request('/auth/me'),
  googleAuth: (idToken: string): Promise<{ token?: string; userId?: number; needsOnboarding?: boolean; email?: string; name?: string }> =>
    request('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) }),
  forgotPassword: (email: string): Promise<{ ok: true }> =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (email: string, code: string, newPassword: string): Promise<{ token: string }> =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, code, newPassword }) }),

  // profile
  getProfile: (): Promise<ProfileResponse> => profileCache.get(),
  // Profile fields feed the TDEE/plan engine (activity, height, sex, dob) and
  // weightKg feeds the weight trend, so a profile write invalidates both caches.
  updateProfile: (data: object): Promise<{ ok: true }> =>
    request<{ ok: true }>('/profile', { method: 'PUT', body: JSON.stringify(data) })
      .then(r => { profileCache.invalidate(); planStatusCache.invalidate(); return r; }),
  deleteAccount: (): Promise<{ ok: true }> => request('/profile', { method: 'DELETE' }),
  heartbeat: (): Promise<{ ok: true }> => request('/profile/heartbeat', { method: 'POST' }),

  // habits
  getHabits: (): Promise<{ name: string; startDate: string | null; cadence?: string; quitStartedAt?: string | null; starred?: boolean; dueDate?: string | null; reminderHour?: number | null; schedule?: string | null; sharedWithFriends?: boolean }[]> => request('/habits'),
  updateHabits: (habits: (string | { name: string; cadence: string })[]): Promise<{ ok: true }> =>
    request('/habits', { method: 'PUT', body: JSON.stringify({ habits }) }),
  setQuitStart: (name: string, startedAt: string): Promise<{ ok: true }> =>
    request('/habits/quit-start', { method: 'PATCH', body: JSON.stringify({ name, startedAt }) }),
  setHabitStar: (name: string, starred: boolean): Promise<{ ok: true }> =>
    request('/habits/star', { method: 'PATCH', body: JSON.stringify({ name, starred }) }),
  setHabitDueDate: (name: string, dueDate: string | null): Promise<{ ok: true }> =>
    request('/habits/due-date', { method: 'PATCH', body: JSON.stringify({ name, dueDate }) }),
  setHabitReminder: (name: string, hour: number | null): Promise<{ ok: true }> =>
    request('/habits/reminder', { method: 'PATCH', body: JSON.stringify({ name, hour }) }),
  setHabitSchedule: (name: string, schedule: string | null): Promise<{ ok: true }> =>
    request('/habits/schedule', { method: 'PATCH', body: JSON.stringify({ name, schedule }) }),
  archiveHabit: (name: string): Promise<{ ok: true }> => request(`/habits/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  restoreHabit: (name: string): Promise<{ ok: true }> => request(`/habits/${encodeURIComponent(name)}/restore`, { method: 'POST' }),
  deleteHabitPermanently: (name: string): Promise<{ ok: true }> => request(`/habits/${encodeURIComponent(name)}/permanent`, { method: 'DELETE' }),
  getGraveyard: (): Promise<{ name: string; startDate: string | null }[]> => request('/habits/graveyard'),

  // entitlement — what this account may do. Read-only; the server enforces it
  // again on every route that gates something. `habitLimit: null` = no ceiling.
  getEntitlement: (): Promise<EntitlementResponse> => request('/entitlement'),

  // tracker
  getTracker: (): Promise<TrackerResponse> => request('/tracker'),
  // A tracker day carries weight/steps, both of which feed the plan/stall engine.
  updateTrackerDay: (day: string, data: object): Promise<{ ok: true }> =>
    request<{ ok: true }>('/tracker', { method: 'PATCH', body: JSON.stringify({ day, ...data }) })
      .then(r => { planStatusCache.invalidate(); return r; }),
  toggleTrackerHabit: (day: string, habitName: string, state: 'done' | 'failed' | 'na' | null): Promise<{ ok: true }> =>
    request('/tracker/habit', { method: 'PATCH', body: JSON.stringify({ day, habitName, state }) }),

  // steps (provenance-aware)
  getSteps: (day?: string): Promise<{ entries: StepEntry[] }> =>
    request(`/steps${day ? `?day=${encodeURIComponent(day)}` : ''}`),
  addSteps: (day: string, steps: number, source: StepSource = 'manual'): Promise<{ ok: true; day: string }> =>
    request('/steps', { method: 'POST', body: JSON.stringify({ day, steps, source }) }),
  bulkSteps: (entries: { day: string; source: StepSource; steps: number }[]): Promise<{ ok: true; written: number }> =>
    request('/steps/bulk', { method: 'POST', body: JSON.stringify({ entries }) }),

  // tasks & lists
  getTasks: (): Promise<TaskRow[]> => request('/tasks'),
  createTask: (id: string, text: string, dueDate?: string): Promise<{ ok: true }> =>
    request('/tasks', { method: 'POST', body: JSON.stringify({ id, text, type: 'todo', dueDate }) }),
  createShoppingItem: (id: string, text: string): Promise<{ ok: true }> =>
    request('/tasks', { method: 'POST', body: JSON.stringify({ id, text, type: 'shopping' }) }),
  updateTask: (id: string, done: boolean): Promise<{ ok: true }> =>
    request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ done }) }),
  deleteTask: (id: string): Promise<{ ok: true }> => request(`/tasks/${id}`, { method: 'DELETE' }),

  // journal (free text + optional mood 1..5; feeds Dub)
  getJournal: (): Promise<{ id: string; body: string; mood: number | null; createdAt: string }[]> => request('/journal'),
  createJournalEntry: (id: string, body: string, mood: number | null): Promise<{ ok: true }> =>
    request('/journal', { method: 'POST', body: JSON.stringify({ id, body, mood }) }),
  deleteJournalEntry: (id: string): Promise<{ ok: true }> => request(`/journal/${id}`, { method: 'DELETE' }),

  // SMART goals
  getGoals: (): Promise<SmartGoal[]> => request('/goals'),
  createGoal: (goal: object): Promise<{ ok: true }> => request('/goals', { method: 'POST', body: JSON.stringify(goal) }),
  updateGoal: (id: string, data: object): Promise<{ ok: true }> => request(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGoal: (id: string): Promise<{ ok: true }> => request(`/goals/${id}`, { method: 'DELETE' }),

  // diet
  getDietTarget: (): Promise<DietTargetResponse> => request('/diet/target'),
  updateDietTarget: (data: object): Promise<{ ok: true }> =>
    request('/diet/target', { method: 'PUT', body: JSON.stringify(data) }),
  getDietSettings: (): Promise<DietSettingsResponse> => request('/diet/settings'),
  updateDietSettings: (data: object): Promise<{ ok: true }> =>
    request('/diet/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getDietPlans: (): Promise<DietPlanRow[]> => request('/diet/plans'),
  createDietPlan: (plan: object): Promise<{ ok: true }> =>
    request('/diet/plans', { method: 'POST', body: JSON.stringify(plan) }),
  deleteDietPlan: (id: string): Promise<{ ok: true }> => request(`/diet/plans/${id}`, { method: 'DELETE' }),
  renameDietPlan: (id: string, label: string): Promise<{ ok: true }> =>
    request(`/diet/plans/${id}`, { method: 'PATCH', body: JSON.stringify({ label }) }),

  // weight settings
  getWeightSettings: (): Promise<WeightSettingsResponse> => request('/weight-settings'),
  // Weight-settings (goal rate, target) feed the plan engine.
  updateWeightSettings: (data: object): Promise<{ ok: true }> =>
    request<{ ok: true }>('/weight-settings', { method: 'PUT', body: JSON.stringify(data) })
      .then(r => { planStatusCache.invalidate(); return r; }),

  // plan engine — every write here changes plan status, so each invalidates its cache.
  getPlanStatus: (): Promise<PlanStatusResponse> => planStatusCache.get(),
  createPlanGoal: (targetWeight: number, targetDate: string): Promise<CreatePlanGoalResponse> =>
    request<CreatePlanGoalResponse>('/plan/goal', { method: 'POST', body: JSON.stringify({ targetWeight, targetDate }) })
      .then(r => { planStatusCache.invalidate(); return r; }),
  abandonPlanGoal: (): Promise<{ ok: true }> =>
    request<{ ok: true }>('/plan/goal', { method: 'DELETE' }).then(r => { planStatusCache.invalidate(); return r; }),
  patchPlanStartDate: (startDate: string): Promise<{ ok: true }> =>
    request<{ ok: true }>('/plan/goal/start-date', { method: 'PATCH', body: JSON.stringify({ startDate }) })
      .then(r => { planStatusCache.invalidate(); return r; }),
  runPlanCycle: (): Promise<PlanCycleResponse> =>
    request<PlanCycleResponse>('/plan/cycle', { method: 'POST' }).then(r => { planStatusCache.invalidate(); return r; }),
  resolvePlanReached: (action: 'maintain' | 'dismiss'): Promise<ResolvePlanReachedResponse> =>
    request<ResolvePlanReachedResponse>('/plan/resolve-reached', { method: 'POST', body: JSON.stringify({ action }) })
      .then(r => { planStatusCache.invalidate(); return r; }),

  // AI key


  // daily check-in (energy + adherence + optional workout + sleep)
  submitCheckIn: (data: {
    energy?: number;
    adherence?: 'below' | 'about' | 'above';
    mood?: number;
    workoutDone?: boolean;
    workoutIntensity?: 'light' | 'moderate' | 'intense' | 'very_intense';
    workoutDurationMin?: number;
    sleepHours?: number;
    sleepBedtime?: string;
    sleepWaketime?: string;
    adherenceLevel?: number;
  }): Promise<{ ok: true; xpAwarded: number; workoutCalories: number | null }> =>
    request('/checkin', { method: 'POST', body: JSON.stringify(data) }),
  getRecentCheckIns: (): Promise<RecentCheckInsResponse> => request('/checkin/recent'),
  getCheckInHistory: (days = 90): Promise<{ entries: { date: string; energy: number | null; mood: number | null; adherence: string | null; adherenceLevel: number | null; workoutIntensity: string | null; workoutDurationMin: number | null; sleep: number | null; bedtime: string | null; waketime: string | null }[] }> =>
    request(`/checkin/history?days=${days}`),
  getCoachingMessage: (): Promise<CoachingResponse> => request('/checkin/coaching'),

  // lapse protocol — raw signals; src/lapse.ts turns them into a state
  getLapse: (): Promise<LapseSignalsResponse> =>
    request(`/lapse?tzOffset=${new Date().getTimezoneOffset()}`),
  restoreStreak: (): Promise<{ ok: true; daysRestored: number }> =>
    request(`/lapse/restore?tzOffset=${new Date().getTimezoneOffset()}`, { method: 'POST' }),
  getWeeklyIntention: (weekStart: string): Promise<{ intention: string | null }> =>
    request(`/checkin/weekly-intention?weekStart=${encodeURIComponent(weekStart)}`),
  saveWeeklyIntention: (weekStart: string, intention: string): Promise<{ ok: true }> =>
    request('/checkin/weekly-intention', { method: 'POST', body: JSON.stringify({ weekStart, intention }) }),

  // push notifications
  getVapidKey: (): Promise<{ key: string }> => request('/push/vapid-public-key'),
  pushSubscribe: (subscription: any, tzOffsetMinutes: number, reminderHour?: number, workoutHour?: number | null, eveningHour?: number) =>
    request('/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription, tzOffsetMinutes, reminderHour, workoutHour, eveningHour }) }),
  pushUnsubscribe: (endpoint?: string): Promise<{ ok: true }> =>
    request('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) }),
  pushSetReminderTime: (hour: number): Promise<{ ok: true; hour: number }> =>
    request('/push/reminder-time', { method: 'POST', body: JSON.stringify({ hour }) }),
  pushSetPromptTimes: (times: { workoutHour?: number | null; eveningHour?: number }): Promise<{ ok: true }> =>
    request('/push/prompt-times', { method: 'POST', body: JSON.stringify(times) }),

  // community global habit (this month's shared XP goal)
  getGlobalHabit: (): Promise<{ month: string; title: string; habit: string; goal: number; total: number; contributors: number; mine: number; myDays: number; doneToday: boolean }> =>
    request('/global'),
  contributeGlobal: (xp: number): Promise<{ ok: true }> =>
    request('/global/contribute', { method: 'POST', body: JSON.stringify({ xp }) }),
  uncontributeGlobal: (): Promise<{ ok: true }> =>
    request('/global/uncontribute', { method: 'POST' }),

  // ── Friends / social ──
  getFriends: (): Promise<{
    friends: { id: number; name: string; email: string; streak: number | null; activeDays: number | null; lastActive: string | null; sharedHabits: string[]; shares: boolean }[];
    incoming: { id: number; name: string; email: string }[];
    outgoing: { id: number; name: string; email: string }[];
  }> => request('/friends'),
  sendFriendRequest: (email: string): Promise<{ ok: true; status: 'pending' | 'accepted' }> =>
    request('/friends/request', { method: 'POST', body: JSON.stringify({ email }) }),
  respondFriend: (userId: number, action: 'accept' | 'decline'): Promise<{ ok: true }> =>
    request('/friends/respond', { method: 'POST', body: JSON.stringify({ userId, action }) }),
  removeFriend: (userId: number): Promise<{ ok: true }> => request(`/friends/${userId}`, { method: 'DELETE' }),
  getFriendSettings: (): Promise<{ shareActivity: boolean }> => request('/friends/settings'),
  setFriendSettings: (shareActivity: boolean): Promise<{ ok: true; shareActivity: boolean }> =>
    request('/friends/settings', { method: 'POST', body: JSON.stringify({ shareActivity }) }),
  setHabitShare: (name: string, shared: boolean): Promise<{ ok: true }> =>
    request('/friends/habit-share', { method: 'POST', body: JSON.stringify({ name, shared }) }),
  getFriendProfile: (userId: number): Promise<{
    id: number; name: string; email: string; memberSince: string; shares: boolean;
    streak: number | null; activeDays: number | null; sharedHabits: string[]; lastActive: string | null;
  }> => request(`/friends/${userId}/profile`),
  // 429 (nudged too recently) surfaces as a thrown Error with the server message.
  nudgeFriend: (userId: number): Promise<{ ok: true; delivered: boolean }> =>
    request(`/friends/${userId}/nudge`, { method: 'POST' }),
};
