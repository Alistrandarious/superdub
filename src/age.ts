// Age from date of birth, and the minimum age to hold an account.
//
// The privacy policy already states Superdub "is not intended for children under
// the age of 13" — but nothing enforced it. DOB was collected and an age was
// computed on both the client and the server, and neither ever checked it, so
// the policy promised something the code did not do.
//
// ponytail: the server keeps its own copy of MIN_AGE_YEARS (server/routes/auth.ts)
// because nothing in server/ imports from src/ today — same reason energy.ts is
// duplicated (ROADMAP E2.3). One constant, two literals; if the age ever changes,
// grep MIN_AGE_YEARS.

/** Under this, no account. Matches the under-13 line in the privacy policy. */
export const MIN_AGE_YEARS = 13;

/**
 * Whole years from `dob` ('YYYY-MM-DD') to today, or null when the date is
 * missing, unparseable, or in the future. Birthday-aware: turning 13 tomorrow
 * still reads as 12 today.
 */
export function ageFromDob(dob: string, today: Date = new Date()): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split('-').map(Number);
  if (!y || !m || !d) return null;
  // Compare calendar parts rather than Date maths: a timezone offset must never
  // shift someone across a birthday boundary.
  let age = today.getFullYear() - y;
  const monthDiff = (today.getMonth() + 1) - m;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age--;
  if (age < 0) return null;          // born in the future
  if (age > 120) return null;        // typo, not a person
  return age;
}

/** True when the DOB is valid AND below the minimum. Unknown ages are not blocked here. */
export function isUnderMinAge(dob: string, today: Date = new Date()): boolean {
  const age = ageFromDob(dob, today);
  return age !== null && age < MIN_AGE_YEARS;
}
