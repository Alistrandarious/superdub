import React from 'react';

/**
 * The "we are not your doctor" line.
 *
 * Superdub sets a calorie target and gives weight-loss guidance, which is
 * exactly the profile app reviewers scrutinise: Apple's guideline 1.4.1 expects
 * apps in this space to tell people to consult a professional, and Google Play
 * requires health apps to say plainly that they are not a medical device.
 * There was no such line anywhere in the app.
 *
 * `variant="inline"` is the quiet footnote used under a screen that gives a
 * number. `variant="block"` is the fuller statement for About and The Maths.
 *
 * Copy follows SUPERDUB_VOICE.md: no dashes, second person, plain words.
 */
const HealthDisclaimer: React.FC<{ variant?: 'inline' | 'block' }> = ({ variant = 'inline' }) => (
  <p className={`health-disclaimer health-disclaimer--${variant}`} role="note">
    {variant === 'block' ? (
      <>
        Superdub is not a medical device and does not diagnose, treat, or prevent
        any condition. Its targets are estimates built from your own numbers, not
        medical advice. Talk to a doctor or a dietitian before you change how you
        eat or exercise, especially if you are pregnant, under 18, or living with
        a health condition.
      </>
    ) : (
      <>
        These numbers are estimates, not medical advice. Talk to a doctor before
        making big changes to how you eat or train.
      </>
    )}
  </p>
);

export default HealthDisclaimer;
