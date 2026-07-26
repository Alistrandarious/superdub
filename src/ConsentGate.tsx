import React from 'react';
import PromptShell from './PromptShell';
import { setAnalyticsConsent } from './analytics';
import { GROWTH } from './theme';

// One-time analytics consent for EXISTING users. New users accept during signup;
// this covers people who were already here when analytics was switched on. It
// shows once, records the decision, and never reappears (per the product call:
// no recurring cookie banner). Full-screen per the pop-up law, reusing the shared
// PromptShell so it looks like every other Superdub moment.
const ConsentGate: React.FC<{ onDecided: () => void }> = ({ onDecided }) => {
  const decide = (granted: boolean) => { setAnalyticsConsent(granted); onDecided(); };
  return (
    <PromptShell
      accent={GROWTH}
      eyebrow="ONE QUICK THING"
      title="Help shape Superdub?"
      subtitle="We'd like to turn on privacy-first analytics so we can see which parts help and which get in the way. No names attached, we never sell your data, and there's no third-party ad tracking. The Privacy Policy has the full detail."
      cta={{ label: 'Sounds good', onClick: () => decide(true) }}
      onDismiss={() => decide(false)}
      dismissLabel="No thanks"
    />
  );
};

export default ConsentGate;
