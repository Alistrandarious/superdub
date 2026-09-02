// Pure screen model for the soft signup flow (src/Auth.tsx). Framework-free on
// purpose so onboarding.check.ts can assert the order + progress without React.
//
// The flow is one gentle thing per screen: create the account, say your name,
// your body, your goal, your first habits, then you're running. Each screen asks
// its own question in its heading — the flow used to be hosted by the Dub mascot,
// which was retired from the app in v2.447, so new users no longer meet a
// companion the rest of the app never shows them.

export type OnbScreen =
  | 'account'  // email + password (or Google)
  | 'name'     // what should we call you
  | 'body'     // dob · sex · height · weight
  | 'goal'     // diet goal + activity + live calorie hint
  | 'habits'   // pick starting habits
  | 'finish';  // your plan, your look, reminders → create account

const ALL_SCREENS: OnbScreen[] = ['account', 'name', 'body', 'goal', 'habits', 'finish'];

// Google signups arrive with a verified account already, so the email/password
// screen is dropped and the flow opens on 'name'.
export function onboardingScreens(isGoogle: boolean): OnbScreen[] {
  return isGoogle ? ALL_SCREENS.filter(s => s !== 'account') : ALL_SCREENS;
}

// Fill % for the progress bar: 1-indexed position over the total, so the first
// screen already reads as a slice of progress and the last reads exactly 100%.
export function onbProgressPct(index: number, total: number): number {
  return Math.round(((index + 1) / total) * 100);
}

// The question each screen asks, as its heading. `finish` titles itself from the
// user's name in Auth.tsx, so it has no prompt here.
export function screenPrompt(screen: OnbScreen, name: string): string {
  switch (screen) {
    case 'account': return "Let's get you set up";
    case 'name':    return 'What should we call you?';
    case 'body':    return name ? `Nice to meet you, ${name}. Tell us about your body` : 'Tell us about your body';
    case 'goal':    return 'What are we working towards?';
    case 'habits':  return 'Which habits should we start with?';
    case 'finish':  return '';
  }
}
