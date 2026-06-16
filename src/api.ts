const BASE = '/api';

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

  // habits
  getHabits: (): Promise<string[]> => request('/habits'),
  updateHabits: (habits: string[]) => request('/habits', { method: 'PUT', body: JSON.stringify({ habits }) }),

  // tracker
  getTracker: (): Promise<{ days: any[]; habits: any[] }> => request('/tracker'),
  updateTrackerDay: (day: string, data: object) =>
    request('/tracker', { method: 'PATCH', body: JSON.stringify({ day, ...data }) }),
  toggleTrackerHabit: (day: string, habitName: string, done: boolean) =>
    request('/tracker/habit', { method: 'PATCH', body: JSON.stringify({ day, habitName, done }) }),

  // tasks
  getTasks: () => request('/tasks'),
  createTask: (id: string, text: string) =>
    request('/tasks', { method: 'POST', body: JSON.stringify({ id, text }) }),
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

  // weight settings
  getWeightSettings: () => request('/weight-settings'),
  updateWeightSettings: (data: object) =>
    request('/weight-settings', { method: 'PUT', body: JSON.stringify(data) }),
};
