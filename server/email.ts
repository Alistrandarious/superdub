import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  if (!resend) {
    console.log('[email] RESEND_API_KEY not set — skipping reset email');
    return;
  }

  await resend.emails.send({
    from: 'Superdub <onboarding@resend.dev>',
    to,
    subject: 'Your Superdub password reset code',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; padding: 0; background: #0d0d0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }
    .wrapper { max-width: 520px; margin: 0 auto; padding: 48px 24px; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 40px 32px; }
    .logo { font-size: 28px; font-weight: 800; color: #00e5ff; letter-spacing: -0.5px; margin: 0 0 8px; }
    .tagline { font-size: 13px; color: #666; margin: 0 0 32px; }
    .divider { border: none; border-top: 1px solid #2a2a2a; margin: 28px 0; }
    h2 { font-size: 22px; font-weight: 700; color: #fff; margin: 0 0 12px; }
    p { font-size: 15px; color: #aaa; line-height: 1.6; margin: 0 0 16px; }
    .code-box { background: #0d0d0d; border: 1px solid #333; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .code { font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #00e5ff; font-family: 'Courier New', monospace; }
    .expiry { font-size: 13px; color: #555; margin: 0; }
    .footer { margin-top: 32px; font-size: 12px; color: #444; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <p class="logo">Superdub</p>
      <p class="tagline">Track habits. Hit goals. Every day.</p>
      <hr class="divider" />
      <h2>Password reset</h2>
      <p>We received a request to reset your password. Use the code below — it expires in <strong style="color:#fff">15 minutes</strong>.</p>
      <div class="code-box">
        <div class="code">${code}</div>
      </div>
      <p class="expiry">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
    </div>
    <p class="footer">© ${new Date().getFullYear()} Superdub</p>
  </div>
</body>
</html>
    `.trim(),
  });
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  if (!resend) {
    console.log('[email] RESEND_API_KEY not set — skipping welcome email');
    return;
  }

  const displayName = name?.trim() || 'there';

  await resend.emails.send({
    from: 'Superdub <onboarding@resend.dev>',
    to,
    subject: `Welcome to Superdub, ${displayName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; padding: 0; background: #0d0d0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }
    .wrapper { max-width: 520px; margin: 0 auto; padding: 48px 24px; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 40px 32px; }
    .logo { font-size: 28px; font-weight: 800; color: #00e5ff; letter-spacing: -0.5px; margin: 0 0 8px; }
    .tagline { font-size: 13px; color: #666; margin: 0 0 32px; }
    .divider { border: none; border-top: 1px solid #2a2a2a; margin: 28px 0; }
    h2 { font-size: 22px; font-weight: 700; color: #fff; margin: 0 0 12px; }
    p { font-size: 15px; color: #aaa; line-height: 1.6; margin: 0 0 16px; }
    .highlight { color: #fff; }
    .feature-list { list-style: none; padding: 0; margin: 20px 0; }
    .feature-list li { font-size: 14px; color: #aaa; padding: 6px 0; }
    .feature-list li::before { content: '✓ '; color: #00e5ff; font-weight: 700; }
    .cta { display: inline-block; margin-top: 8px; padding: 14px 28px; background: #00e5ff; color: #000; font-size: 15px; font-weight: 700; border-radius: 10px; text-decoration: none; }
    .footer { margin-top: 32px; font-size: 12px; color: #444; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <p class="logo">Superdub</p>
      <p class="tagline">Track habits. Hit goals. Every day.</p>
      <hr class="divider" />
      <h2>Hey ${displayName} 👋</h2>
      <p>Welcome aboard! Your account is all set up and ready to go.</p>
      <p>Here's what you can do with <span class="highlight">Superdub</span>:</p>
      <ul class="feature-list">
        <li>Log daily habits and watch your streaks grow</li>
        <li>Track your weight with a visual progress curve</li>
        <li>Hit your calorie and macro targets every day</li>
        <li>Manage tasks and stay on top of your goals</li>
      </ul>
      <p>Start by opening the app and filling in today's entries — consistency is everything.</p>
    </div>
    <p class="footer">You're receiving this because you signed up at Superdub.<br/>© ${new Date().getFullYear()} Superdub</p>
  </div>
</body>
</html>
    `.trim(),
  });
}
