// Which daily prompts the user wants to be asked. Each is on unless the user turns
// it off in the menu. Weight is special: until the user sets an explicit choice it
// follows the weight plan — on while a plan is active, off otherwise — so people who
// aren't running a plan aren't nagged to weigh in every morning.
export type PromptKey = 'weight' | 'sleep' | 'energy' | 'mood';

const keyOf = (k: PromptKey) => `superdub.prompt.${k}`;

// Is an Adaptive Weight Plan currently active? Read from the badge App/Plan persist.
export function planActive(): boolean {
  try {
    return !!(JSON.parse(localStorage.getItem('superdub.plan.badge') ?? '{}')?.active);
  } catch {
    return false;
  }
}

export function promptEnabled(k: PromptKey): boolean {
  const v = localStorage.getItem(keyOf(k));
  if (v === 'true') return true;
  if (v === 'false') return false;
  return k === 'weight' ? planActive() : true; // unset → weight follows the plan, others on
}

export function setPromptEnabled(k: PromptKey, on: boolean): void {
  localStorage.setItem(keyOf(k), on ? 'true' : 'false');
}

// The weather chip in the Habits header. Not a PromptKey — it isn't a daily question,
// it's a piece of header furniture. On unless the user turns it off in the menu.
const WEATHER_KEY = 'superdub.weather.enabled';

export const weatherEnabled = (): boolean => localStorage.getItem(WEATHER_KEY) !== 'false';

export const setWeatherEnabled = (on: boolean): void =>
  localStorage.setItem(WEATHER_KEY, on ? 'true' : 'false');
