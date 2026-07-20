import { Resend } from 'resend';
import { makeUnsubToken } from './services/emailConsent';
import type { UserSnapshot } from './services/userSnapshot';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = 'Superdub <onboarding@resend.dev>'; // ponytail: shared Resend test domain; swap for a verified @superdub domain before lifecycle volume.
const APP_URL = (process.env.APP_URL || 'https://superdub.onrender.com').replace(/\/$/, '');

// ── Shared shell ──────────────────────────────────────────────────────────────
// One dark, brand-aligned card that every email renders inside, so the surface,
// wordmark, and CTA live in exactly one place. Palette mirrors App.css :root:
// surface #0E0E14 / raised #15151E, border #252532, text #E0E0F0, brand green
// #2FD27E, and gold #FFB928 reserved for wins (callers pass gold spans in body).
// Table-based + inline-safe for email clients (no external CSS, no SVG — Gmail
// strips <style> partially and SVG entirely).

interface ShellOpts {
  title: string;        // <title> + hidden preheader
  heading: string;
  bodyHtml: string;     // trusted inner HTML (we build it, never user input)
  ctaLabel?: string;
  ctaHref?: string;     // '/path' is prefixed with APP_URL; absolute URLs pass through
  unsubToken?: string;  // present → renders the unsubscribe footer (lifecycle email only)
  dubVoice?: boolean;   // present → green "Dub" header band, for the mascot-voiced emails
}

function resolveHref(href: string): string {
  return href.startsWith('/') ? `${APP_URL}${href}` : href;
}

function emailShell(o: ShellOpts): string {
  const dubBand = o.dubVoice
    ? `<tr><td style="padding:0 32px;"><div style="font-size:13px;font-weight:700;letter-spacing:0.02em;color:#2FD27E;margin:0 0 4px;">Dub here</div></td></tr>`
    : '';
  const cta = o.ctaLabel && o.ctaHref
    ? `<tr><td style="padding:8px 32px 4px;"><a href="${resolveHref(o.ctaHref)}" style="display:inline-block;padding:14px 28px;background:#2FD27E;color:#06130C;font-size:15px;font-weight:700;border-radius:10px;text-decoration:none;">${o.ctaLabel}</a></td></tr>`
    : '';
  const unsub = o.unsubToken
    ? `<br/><a href="${APP_URL}/api/email/unsubscribe?token=${o.unsubToken}" style="color:#666;text-decoration:underline;">Unsubscribe from these emails</a>`
    : '';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${o.title}</title>
</head>
<body style="margin:0;padding:0;background:#0E0E14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${o.title}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0E0E14;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#15151E;border:1px solid #252532;border-radius:16px;">
        <tr><td style="padding:36px 32px 8px;">
          <div style="font-size:26px;font-weight:800;color:#2FD27E;letter-spacing:-0.5px;">Superdub</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">Track habits. Hit goals. Every day.</div>
        </td></tr>
        ${dubBand}
        <tr><td style="padding:16px 32px 4px;">
          <h2 style="font-size:22px;font-weight:700;color:#E0E0F0;margin:0 0 12px;">${o.heading}</h2>
        </td></tr>
        <tr><td style="padding:0 32px 8px;font-size:15px;color:rgba(255,255,255,0.62);line-height:1.6;">
          ${o.bodyHtml}
        </td></tr>
        ${cta}
        <tr><td style="padding:28px 32px 32px;">
          <div style="border-top:1px solid #252532;margin-bottom:16px;"></div>
          <div style="font-size:12px;color:#555;line-height:1.6;">© ${new Date().getFullYear()} Superdub${unsub}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

async function send(to: string, subject: string, html: string, label: string): Promise<void> {
  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set — skipping ${label} to ${to}`);
    return;
  }
  await resend.emails.send({ from: FROM, to, subject, html });
}

// ── Transactional (no unsubscribe — account-critical) ───────────────────────────

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const html = emailShell({
    title: 'Your Superdub password reset code',
    heading: 'Password reset',
    bodyHtml: `
      <p style="margin:0 0 16px;">We received a request to reset your password. Use the code below. It expires in <strong style="color:#E0E0F0;">15 minutes</strong>.</p>
      <div style="background:#0E0E14;border:1px solid #333;border-radius:12px;padding:20px;text-align:center;margin:16px 0;">
        <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#2FD27E;font-family:'Courier New',monospace;">${code}</div>
      </div>
      <p style="margin:0;font-size:13px;color:#555;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>`,
  });
  await send(to, 'Your Superdub password reset code', html, 'reset email');
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const displayName = name?.trim() || 'there';
  const html = emailShell({
    title: `Welcome to Superdub, ${displayName}`,
    heading: `Hey ${displayName}, welcome aboard.`,
    bodyHtml: `
      <p style="margin:0 0 16px;">Your account is all set up and ready to go. Here's what you can do with Superdub:</p>
      <ul style="list-style:none;padding:0;margin:16px 0;">
        <li style="padding:6px 0;"><span style="color:#2FD27E;font-weight:700;">&#10003;</span> Log daily habits and watch your streaks grow</li>
        <li style="padding:6px 0;"><span style="color:#2FD27E;font-weight:700;">&#10003;</span> Track your weight with a visual progress curve</li>
        <li style="padding:6px 0;"><span style="color:#2FD27E;font-weight:700;">&#10003;</span> Hit your daily targets, every day</li>
        <li style="padding:6px 0;"><span style="color:#2FD27E;font-weight:700;">&#10003;</span> Manage tasks and stay on top of your goals</li>
      </ul>
      <p style="margin:0;">Start by opening the app and filling in today's entries. Consistency is everything.</p>`,
    ctaLabel: 'Open Superdub',
    ctaHref: '/',
  });
  await send(to, `Welcome to Superdub, ${displayName}`, html, 'welcome email');
}

// ── Lifecycle (P2–P4) ───────────────────────────────────────────────────────────

// P2: habits-cleared safety net. Dub-less (a utility "here's your undo" moment).
// build* returns { subject, html } so it can be previewed without sending.
export function buildHabitsClearedEmail(name: string, count: number): { subject: string; html: string } {
  const who = name?.trim() ? `, ${name.trim()}` : '';
  const html = emailShell({
    title: 'Your habits are safe in the graveyard',
    heading: 'Your habits are safe in the graveyard',
    bodyHtml: `
      <p style="margin:0 0 16px;">You just cleared out ${count} ${count === 1 ? 'habit' : 'habits'}${who}. No stress, nothing is gone for good.</p>
      <p style="margin:0 0 16px;">They're resting in the graveyard and you can bring any of them back with a tap. Your streaks and history come back with them.</p>
      <p style="margin:0;">Changed your mind? Open the graveyard below. Meant to do it? You're all set, no action needed.</p>`,
    ctaLabel: 'Open the graveyard',
    ctaHref: '/habits',
    // Reversible account action, not marketing — no unsubscribe footer.
  });
  return { subject: 'Your habits are safe in the graveyard', html };
}
export async function sendHabitsClearedEmail(to: string, name: string, count: number): Promise<void> {
  const { subject, html } = buildHabitsClearedEmail(name, count);
  await send(to, subject, html, 'habits-cleared email');
}

// P3: weekly highlight. Dub voices it. Two shapes off the same snapshot: a full recap
// for people who logged this week, a lighter "here's what you missed" for quiet users.
export function buildWeeklyHighlightEmail(s: UserSnapshot): { subject: string; html: string } {
  const name = s.name?.trim() || 'there';
  const token = makeUnsubToken(s.userId);
  const active = s.weekTicks > 0 || s.weighIns > 0;

  let body: string;
  if (active) {
    const tiles: string[] = [];
    if (s.weekPossible > 0) tiles.push(tile('Habits ticked', `${s.weekTicks}`, `of ${s.weekPossible} this week`));
    else if (s.weekTicks > 0) tiles.push(tile('Habits ticked', `${s.weekTicks}`, 'this week'));
    if (s.streakDays > 0) tiles.push(tile('Current streak', `${s.streakDays}`, s.streakDays === 1 ? 'day' : 'days', true));
    if (s.weighIns > 0) tiles.push(tile('Weigh-ins', `${s.weighIns}`, 'logged this week'));
    if (s.weightDeltaKg != null && s.weightDeltaKg !== 0) {
      const down = s.weightDeltaKg < 0;
      tiles.push(tile('Weight moved', `${down ? '' : '+'}${s.weightDeltaKg} kg`, 'this week', down));
    }
    // Two tiles per row so 3–4 stats wrap instead of overflowing a single row.
    const rows: string[] = [];
    for (let i = 0; i < tiles.length; i += 2) rows.push(`<tr>${tiles.slice(i, i + 2).join('')}</tr>`);
    body = `
      <p style="margin:0 0 16px;">Here's how your week went.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table>
      <p style="margin:16px 0 0;color:#E0E0F0;">${escapeHtml(s.coachingLine)}</p>`;
  } else {
    body = `
      <p style="margin:0 0 16px;">Quiet week? That's alright. Your habits, streaks, and history are all still here waiting for you.</p>
      <p style="margin:0;color:#E0E0F0;">Pick one habit and tick it today. That's the whole trick.</p>`;
  }

  const html = emailShell({
    title: `Dub's got your week, ${name}`,
    heading: active ? `Your week, ${name}` : `Dub saved your spot, ${name}`,
    bodyHtml: body,
    ctaLabel: active ? 'See your progress' : 'Open Superdub',
    ctaHref: active ? '/progress' : '/',
    unsubToken: token,
    dubVoice: true,
  });
  return { subject: `Dub's got your week, ${name}`, html };
}
export async function sendWeeklyHighlightEmail(s: UserSnapshot): Promise<void> {
  const { subject, html } = buildWeeklyHighlightEmail(s);
  await send(s.email, subject, html, 'weekly highlight');
}

// P4: re-engagement. Dub voices it, warm, one ask, no guilt.
export function buildReengagementEmail(s: UserSnapshot): { subject: string; html: string } {
  const name = s.name?.trim() || 'there';
  const token = makeUnsubToken(s.userId);
  const html = emailShell({
    title: `Dub misses you, ${name}`,
    heading: `It's been a bit, ${name}.`,
    bodyHtml: `
      <p style="margin:0 0 16px;">Your streak is paused, not lost, and everything you built is still here.</p>
      <p style="margin:0;color:#E0E0F0;">Pick one habit and tick it today. That's all it takes to start again.</p>`,
    ctaLabel: 'Come back',
    ctaHref: '/',
    unsubToken: token,
    dubVoice: true,
  });
  return { subject: `Dub misses you, ${name}`, html };
}
export async function sendReengagementEmail(s: UserSnapshot): Promise<void> {
  const { subject, html } = buildReengagementEmail(s);
  await send(s.email, subject, html, 're-engagement');
}

// ── tiny render helpers ─────────────────────────────────────────────────────────

// A recap stat. `win` paints the number gold (#FFB928), reserved for wins.
function tile(label: string, value: string, sub: string, win = false): string {
  return `<td width="50%" style="padding:8px;" valign="top">
    <div style="background:#0E0E14;border:1px solid #252532;border-radius:12px;padding:16px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#666;">${label}</div>
      <div style="font-size:28px;font-weight:800;color:${win ? '#FFB928' : '#E0E0F0'};margin-top:4px;">${value}</div>
      <div style="font-size:12px;color:#555;">${sub}</div>
    </div>
  </td>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}
