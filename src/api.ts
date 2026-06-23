// Inside a Capacitor native shell the webview origin is capacitor://localhost, so the
// relative '/api' + CRA dev proxy don't apply — point at the hosted backend directly.
// We read the injected window.Capacitor global rather than importing @capacitor/core so
// the plain web/PWA build has no dependency on the native package.
const isNative =
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

function getToken() {
  return localStorage.getItem('superdub.token');
}

export function setToken(t: string) {
  localStorage.setItem('superdub.token', t);
}

export function clearToken() {
  localStorage.removeItem('superdub.token');
}

export function isLoggedIn() {
  return !!getToken();
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export const api = {
  // auth
  signup: (body: object) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: object) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
  forgotPassword: (email: string) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, code, newPassword }) }),

  // profile
  getProfile: () => request('/profile'),
  updateProfile: (data: object) => request('/profile', { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: () => request('/profile', { method: 'DELETE' }),
  heartbeat: () => request('/profile/heartbeat', { method: 'POST' }),

  // habits
  getHabits: (): Promise<{ name: string; startDate: string | null }[]> => request('/habits'),
  updateHabits: (habits: string[]) => request('/habits', { method: 'PUT', body: JSON.stringify({ habits }) }),
  archiveHabit: (name: string) => request(`/habits/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  restoreHabit: (name: string) => request(`/habits/${encodeURIComponent(name)}/restore`, { method: 'POST' }),
  getGraveyard: (): Promise<{ name: string; startDate: string | null }[]> => request('/habits/graveyard'),

  // tracker
  getTracker: (): Promise<{ days: any[]; habits: any[] }> => request('/tracker'),
  updateTrackerDay: (day: string, data: object) =>
    request('/tracker', { method: 'PATCH', body: JSON.stringify({ day, ...data }) }),
  toggleTrackerHabit: (day: string, habitName: string, state: 'done' | 'failed' | null) =>
    request('/tracker/habit', { method: 'PATCH', body: JSON.stringify({ day, habitName, state }) }),

  // steps (provenance-aware)
  getSteps: (day?: string): Promise<{ entries: StepEntry[] }> =>
    request(`/steps${day ? `?day=${encodeURIComponent(day)}` : ''}`),
  addSteps: (day: string, steps: number, source: StepSource = 'manual') =>
    request('/steps', { method: 'POST', body: JSON.stringify({ day, steps, source }) }),
  bulkSteps: (entries: { day: string; source: StepSource; steps: number }[]) =>
    request('/steps/bulk', { method: 'POST', body: JSON.stringify({ entries }) }),

  // tasks & lists
  getTasks: () => request('/tasks'),
  createTask: (id: string, text: string) =>
    request('/tasks', { method: 'POST', body: JSON.stringify({ id, text, type: 'todo' }) }),
  createShoppingItem: (id: string, text: string) =>
    request('/tasks', { method: 'POST', body: JSON.stringify({ id, text, type: 'shopping' }) }),
  updateTask: (id: string, done: boolean) =>
    request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ done }) }),
  deleteTask: (id: string) => request(`/tasks/${id}`, { method: 'DELETE' }),

  // diet
  getDietTarget: () => request('/diet/target'),
  updateDietTarget: (data: object) =>
    request('/diet/target', { method: 'PUT', body: JSON.stringify(data) }),
  getDietSettings: () => request('/diet/settings'),
  updateDietSettings: (data: object) =>
    request('/diet/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getDietPlans: () => request('/diet/plans'),
  createDietPlan: (plan: object) =>
    request('/diet/plans', { method: 'POST', body: JSON.stringify(plan) }),
  deleteDietPlan: (id: string) => request(`/diet/plans/${id}`, { method: 'DELETE' }),
  renameDietPlan: (id: string, label: string) =>
    request(`/diet/plans/${id}`, { method: 'PATCH', body: JSON.stringify({ label }) }),

  // weight settings
  getWeightSettings: () => request('/weight-settings'),
  updateWeightSettings: (data: object) =>
    request('/weight-settings', { method: 'PUT', body: JSON.stringify(data) }),

  // plan engine
  getPlanStatus: () => request('/plan/status'),
  createPlanGoal: (targetWeight: number, targetDate: string) =>
    request('/plan/goal', { method: 'POST', body: JSON.stringify({ targetWeight, targetDate }) }),
  abandonPlanGoal: () => request('/plan/goal', { method: 'DELETE' }),
  runPlanCycle: () => request('/plan/cycle', { method: 'POST' }),

  // AI key
  getAiKeyStatus: () => request('/profile/ai-key'),
  saveAiKey: (key: string) => request('/profile/ai-key', { method: 'PUT', body: JSON.stringify({ key }) }),

  // meal plans
  getMealPlanRecipeCount: () => request('/meal-plans/recipe-count'),
  seedMealPlanRecipes: () => request('/meal-plans/seed', { method: 'POST' }),
  getRecipeIngredients: (recipeId: number) => request(`/meal-plans/recipe/${recipeId}/ingredients`),
  generateMealPlan: (body: { mealCount: number; days: number; diets: string[]; excludeIds: number[]; includeShake: boolean; halal: boolean }) =>
    request('/meal-plans/generate', { method: 'POST', body: JSON.stringify(body) }),
  swapMeal: (body: { slotName: string; targetCal: number; diets: string[]; excludeIds: number[]; halal: boolean }) =>
    request('/meal-plans/swap', { method: 'POST', body: JSON.stringify(body) }),

  // daily check-in (energy + adherence + optional workout)
  submitCheckIn: (
    energy: number,
    adherence: 'below' | 'about' | 'above',
    mood?: number,
    workoutDone?: boolean,
    workoutIntensity?: 'light' | 'moderate' | 'intense' | 'very_intense',
    workoutDurationMin?: number,
  ) =>
    request('/checkin', { method: 'POST', body: JSON.stringify({ energy, adherence, mood, workoutDone, workoutIntensity, workoutDurationMin }) }),
  getRecentCheckIns: () => request('/checkin/recent'),
  getCheckInHistory: (days = 90): Promise<{ entries: { date: string; energy: number | null; mood: number | null; adherence: string | null }[] }> =>
    request(`/checkin/history?days=${days}`),
  getCoachingMessage: () => request('/checkin/coaching'),
  getWeeklyIntention: (weekStart: string) =>
    request(`/checkin/weekly-intention?weekStart=${encodeURIComponent(weekStart)}`),
  saveWeeklyIntention: (weekStart: string, intention: string) =>
    request('/checkin/weekly-intention', { method: 'POST', body: JSON.stringify({ weekStart, intention }) }),

  // push notifications
  getVapidKey: (): Promise<{ key: string }> => request('/push/vapid-public-key'),
  pushSubscribe: (subscription: any, tzOffsetMinutes: number, reminderHour?: number) =>
    request('/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription, tzOffsetMinutes, reminderHour }) }),
  pushUnsubscribe: (endpoint?: string) =>
    request('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) }),
  pushSetReminderTime: (hour: number) =>
    request('/push/reminder-time', { method: 'POST', body: JSON.stringify({ hour }) }),

  // food log
  parseFoodLog: (transcript: string) =>
    request('/food-log/parse', { method: 'POST', body: JSON.stringify({ transcript }) }),
  getFoodLogsToday: () => request('/food-log/today'),
  saveFoodLog: (data: object) => request('/food-log', { method: 'POST', body: JSON.stringify(data) }),
  deleteFoodLog: (id: string) => request(`/food-log/${id}`, { method: 'DELETE' }),
};
