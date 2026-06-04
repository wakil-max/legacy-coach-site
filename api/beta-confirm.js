// Vercel serverless function: sends a branded beta-confirmation email via Resend.
// Requires the RESEND_API_KEY environment variable (set in Vercel project settings).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const email = (body && body.email ? String(body.email) : '').trim();
  if (!email || email.indexOf('@') < 1) {
    res.status(400).json({ error: 'A valid email is required.' });
    return;
  }

  const KEY = process.env.RESEND_API_KEY;
  if (!KEY) {
    // Email isn't configured yet; don't break the signup flow.
    res.status(200).json({ ok: false, skipped: 'email_not_configured' });
    return;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0c0e0d;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6eae8;">
          <tr><td style="background:#0c0e0d;padding:28px 32px;">
            <span style="display:inline-block;width:34px;height:34px;border-radius:9px;background:#10a876;color:#fff;font-weight:800;font-size:15px;line-height:34px;text-align:center;vertical-align:middle;">LF</span>
            <span style="color:#fff;font-weight:700;font-size:18px;margin-left:10px;vertical-align:middle;">Legacy Foundry</span>
          </td></tr>
          <tr><td style="padding:36px 32px 8px;">
            <h1 style="margin:0 0 14px;font-size:23px;line-height:1.25;">You're on the beta list</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3a423f;">Thanks for signing up for the Legacy Foundry private beta. You're now in the queue, and we'll email this address the moment your invite is ready.</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3a423f;">Legacy Foundry is the AI companion that turns your goals into a daily rhythm of shipped work &mdash; planning, nudging, and keeping you accountable so the important things actually get done.</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3a423f;">While you wait, you can explore how it works:</p>
            <p style="margin:0 0 32px;">
              <a href="https://legacyfoundry.ai/getting-started" style="display:inline-block;background:#10a876;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">See how to get started</a>
            </p>
            <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#3a423f;">Talk soon,</p>
            <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#3a423f;">The Legacy Foundry team</p>
          </td></tr>
          <tr><td style="padding:20px 32px 28px;border-top:1px solid #eef1f0;">
            <p style="margin:0;font-size:12px;line-height:1.5;color:#9aa3a0;">Legacy Foundry &middot; a product of Legacy Ventures<br>You're receiving this because you joined the beta waitlist at legacyfoundry.ai.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Legacy Foundry <noreply@legacyfoundry.ai>',
        to: [email],
        subject: "You're on the Legacy Foundry beta list",
        html: html
      })
    });
    if (!r.ok) {
      const detail = await r.text();
      res.status(502).json({ error: 'send_failed', detail: detail.slice(0, 300) });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'send_error' });
  }
}
