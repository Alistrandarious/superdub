// Runnable self-check for journal mood validation. Run: npx tsx server/routes/journal.check.ts
import assert from 'assert';
import { validJournalMood } from './journal';

// optional — no mood is fine
assert(validJournalMood(undefined) === true, 'undefined ok');
assert(validJournalMood(null) === true, 'null ok');
// valid 1..5
for (const v of [1, 2, 3, 4, 5]) assert(validJournalMood(v) === true, `${v} ok`);
// out of range / non-integer rejected
assert(validJournalMood(0) === false, '0 rejected');
assert(validJournalMood(6) === false, '6 rejected');
assert(validJournalMood(2.5) === false, '2.5 rejected');
assert(validJournalMood('3' as unknown) === false, 'string rejected');

console.log('✓ journal mood validation checks passed');
