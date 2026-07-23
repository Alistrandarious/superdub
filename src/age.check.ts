// Runnable self-check for the age gate. Run: npx tsx src/age.check.ts
//
// The privacy policy promises no under-13 accounts. The boundary cases are the
// whole point: someone who turns 13 tomorrow must still be blocked today, and a
// timezone must never nudge them across that line.
import assert from 'assert';
import { ageFromDob, isUnderMinAge, MIN_AGE_YEARS } from './age';

const TODAY = new Date(2026, 6, 23); // 23 July 2026 (month is 0-based)

// ── Ordinary ages ───────────────────────────────────────────────────────────
assert(ageFromDob('1990-01-01', TODAY) === 36, 'birthday already passed this year');
assert(ageFromDob('2000-12-31', TODAY) === 25, 'birthday still to come this year');

// ── The birthday boundary — the reason this file exists ─────────────────────
assert(ageFromDob('2013-07-23', TODAY) === 13, 'turns 13 TODAY -> is 13');
assert(ageFromDob('2013-07-24', TODAY) === 12, 'turns 13 TOMORROW -> still 12');
assert(ageFromDob('2013-07-22', TODAY) === 13, 'turned 13 yesterday -> is 13');

assert(!isUnderMinAge('2013-07-23', TODAY), 'thirteen today is allowed in');
assert(isUnderMinAge('2013-07-24', TODAY), 'one day short of 13 is blocked');
assert(isUnderMinAge('2020-01-01', TODAY), 'a six-year-old is blocked');
assert(!isUnderMinAge('1990-01-01', TODAY), 'an adult is not blocked');

// Month boundary, where an off-by-one in the 0-based month would show up.
assert(ageFromDob('2013-08-01', TODAY) === 12, 'birthday next month -> not yet');
assert(ageFromDob('2013-06-30', TODAY) === 13, 'birthday last month -> already');

// ── Junk in, null out — never a wrong number ────────────────────────────────
for (const junk of ['', 'not-a-date', '2013', '2013-07', 'abcd-ef-gh']) {
  assert(ageFromDob(junk, TODAY) === null, `unparseable DOB is null: "${junk}"`);
}
assert(ageFromDob('2030-01-01', TODAY) === null, 'a future birth date is null, not negative');
assert(ageFromDob('1850-01-01', TODAY) === null, 'an implausible age is null, not 176');

// An unknown age must NOT be treated as under-age: isUnderMinAge only blocks
// what it can actually read, so a parse failure surfaces as its own error
// message rather than a confusing "you're too young".
assert(!isUnderMinAge('', TODAY), 'missing DOB is not "under age"');
assert(!isUnderMinAge('rubbish', TODAY), 'unparseable DOB is not "under age"');

// ── Timezone safety: the calendar answer must not depend on the clock ───────
// Same calendar day, opposite ends of it. A Date-subtraction implementation can
// drift across a birthday here; comparing calendar parts cannot.
const early = new Date(2026, 6, 23, 0, 1);
const late  = new Date(2026, 6, 23, 23, 59);
assert(
  ageFromDob('2013-07-23', early) === ageFromDob('2013-07-23', late),
  'age is stable across the whole of the birthday itself',
);

assert(MIN_AGE_YEARS === 13, 'minimum age matches the under-13 line in the privacy policy');

console.log('age.check.ts: all assertions passed');
