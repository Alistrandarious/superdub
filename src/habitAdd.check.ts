// Runnable self-check for the recent-add window that gates the "Add a habit" button.
// Run: npx tsx src/habitAdd.check.ts
import assert from 'assert';
import { RECENT_ADD_DAYS, daysSince } from './habitAdd';

// Local (not UTC) date string, so it matches how daysSince parses it (local midnight);
// toISOString() would skew by a day near tz boundaries and make the day-counts flaky.
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

// Today's add reads as 0 days old, so it's inside the window and suppresses the button.
assert(daysSince(daysAgo(0)) === 0, 'today is 0 days ago');
assert(daysSince(daysAgo(2)) < RECENT_ADD_DAYS, 'a 2-day-old add is still recent (button hidden)');

// The window is exclusive at RECENT_ADD_DAYS: day 3 is no longer recent, button returns.
assert(daysSince(daysAgo(3)) >= RECENT_ADD_DAYS, `a ${RECENT_ADD_DAYS}-day-old add is no longer recent`);
assert(daysSince(daysAgo(4)) >= RECENT_ADD_DAYS, 'a 4-day-old add is not recent');

// No start date → never counts as a recent add (never suppresses the button).
assert(daysSince(null) === Infinity, 'missing start date is not recent');
assert(daysSince(undefined) === Infinity, 'undefined start date is not recent');

console.log('✓ habitAdd checks passed');
