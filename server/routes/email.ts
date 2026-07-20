import { Router, Request, Response } from 'express';
import { verifyUnsubToken, setEmailOptOut } from '../services/emailConsent';

const router = Router();

const page = (title: string, msg: string) => `
<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;background:#0E0E14;color:#E0E0F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:80px 24px;text-align:center;">
    <div style="font-size:26px;font-weight:800;color:#2FD27E;">Superdub</div>
    <h1 style="font-size:20px;margin:24px 0 8px;">${title}</h1>
    <p style="color:rgba(255,255,255,0.62);line-height:1.6;">${msg}</p>
  </div>
</body></html>`;

// GET /api/email/unsubscribe?token=… — opt this user out of lifecycle email.
// No login: the signed token IS the authorisation, and it only ever opts out (a
// safe, idempotent, reversible action) so link-prefetching can't do harm.
router.get('/unsubscribe', async (req: Request, res: Response) => {
  const token = String(req.query.token ?? '');
  const userId = verifyUnsubToken(token);
  if (userId == null) {
    return res.status(400).send(page('Link not valid', "This unsubscribe link is broken or expired. You can manage email in the app's settings."));
  }
  try {
    await setEmailOptOut(userId, true);
    res.send(page('You are unsubscribed', 'You will no longer get weekly highlight or re-engagement emails. Account emails like password resets still come through. Changed your mind? You can turn these back on in Superdub settings.'));
  } catch {
    res.status(500).send(page('Something went wrong', 'We could not update your preference just now. Please try again in a moment.'));
  }
});

export default router;
