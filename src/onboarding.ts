// Pure screen model for the soft signup flow (src/Auth.tsx). Framework-free on
// purpose so onboarding.check.ts can assert the order + progress without React.
//
// The flow is one gentle thing per screen: create the account, say your name,
// your body, your goal, your first habits, a look at your day, meeting Dub (with
// customization woven in), a little optional colour about you, then you're running.

export type OnbScreen =
  | 'account'  // email + password (or Google)
  | 'name'     // what should we call you
  | 'body'     // dob · sex · height · weight
  | 'goal'     // diet goal + activity + live calorie hint
  | 'habits'   // pick starting habits
  | 'day'      // preview of the daily window on its own
  | 'dub'      // meet Dub + make it yours (cosmetics)
  | 'more'     // optional demographics (skippable)
  | 'finish';  // you're all set → create account

const ALL_SCREENS: OnbScreen[] = ['account', 'name', 'body', 'goal', 'habits', 'day', 'dub', 'more', 'finish'];

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

// What Dub says on each screen — he hosts the whole flow, Duolingo-style, asking
// each question from his speech bubble. `finish` is the silent reveal (no line).
export function dubLine(screen: OnbScreen, name: string): string {
  switch (screen) {
    case 'account': return "Hi, I'm Dub! Let's get you set up.";
    case 'name':    return 'First up, what should I call you?';
    case 'body':    return name ? `Nice to meet you, ${name}! Tell me a bit about your body.` : 'Tell me a bit about your body.';
    case 'goal':    return 'What are we working towards?';
    case 'habits':  return 'Which habits should we start together?';
    case 'day':     return 'This is your day. Try closing one!';
    case 'more':    return 'A few optional bits, or skip them.';
    case 'dub':     return 'Now, make me yours.';
    case 'finish':  return '';
  }
}
