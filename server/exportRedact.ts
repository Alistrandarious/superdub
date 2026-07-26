// Which columns must NEVER appear in a user's data export, per table.
// The export (GET /api/profile/export, server/routes/profile.ts) hands the user
// a copy of everything we hold about them for GDPR portability — but "everything
// about them" must not include secrets they could be harmed by leaking, or that
// aren't theirs to hold in plaintext.
//
// Pure and dependency-free so it can be unit-checked (exportRedact.check.ts)
// without standing up Express or a database.

export const EXPORT_OMIT: Record<string, string[]> = {
  // The bcrypt hash of their password. Never leaves the server.
  users: ['password_hash'],
  // Their own Anthropic API key, stored to power AI features. A secret.
  profile: ['anthropic_api_key'],
  // Web-push crypto material — device secrets, not useful data to a person.
  push_subscriptions: ['p256dh', 'auth'],
};

/** Return a copy of `row` with this table's sensitive columns removed. */
export function redactExportRow(table: string, row: Record<string, any>): Record<string, any> {
  const omit = EXPORT_OMIT[table];
  if (!omit || !row) return row;
  const out = { ...row };
  for (const col of omit) delete out[col];
  return out;
}
