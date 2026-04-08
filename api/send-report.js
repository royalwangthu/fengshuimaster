export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    const { email, score, headline, description } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'No email provided' });
    }

    const htmlBody = `
      <div style="max-width:600px;margin:0 auto;background:#0A0A0C;color:#fff;padding:2rem;font-family:sans-serif;border-radius:16px">
        <div style="text-align:center;margin-bottom:1.5rem">
          <span style="font-size:24px">✦</span>
          <h1 style="font-size:18px;color:#E2AA3A;margin:.5rem 0">FengShuiMaster</h1>
          <p style="font-size:12px;color:rgba(255,252,248,.5)">Your Personalized Energy Report</p>
        </div>
        <div style="text-align:center;margin-bottom:1.5rem">
          <div style="display:inline-block;width:80px;height:80px;border-radius:50%;border:3px solid #E2AA3A;line-height:80px;font-size:28px;font-weight:700;color:#FFD466">${score || '?'}</div>
          <p style="font-size:10px;color:rgba(226,170,58,.6);margin-top:.5rem;text-transform:uppercase;letter-spacing:.1em">Fengshui Score</p>
        </div>
        <h2 style="font-size:16px;text-align:center;margin-bottom:.5rem">${headline || 'Your Energy Report'}</h2>
        <p style="font-size:13px;color:rgba(255,252,248,.6);text-align:center;line-height:1.6;margin-bottom:1.5rem">${description || ''}</p>
        <div style="text-align:center;margin-bottom:1.5rem">
          <a href="https://fengshuimaster.pro/dashboard.html" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#E2AA3A,#C49A30);color:#0A0A0C;text-decoration:none;border-radius:10px;font-weight:700;font-size:13px">View Full Report</a>
        </div>
        <p style="font-size:10px;color:rgba(255,252,248,.3);text-align:center">Open on the same browser where you completed your reading to see the full report.</p>
      </div>
    `;

    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`
      },
      body: JSON.stringify({
        from: 'FengShuiMaster <noreply@fengshuimaster.pro>',
        to: [email],
        subject: 'Your Feng Shui Energy Report — Score: ' + (score || '?') + '/100',
        html: htmlBody
      })
    });

    const data = await emailResp.json();

    if (!emailResp.ok) {
      return res.status(500).json({ error: data.message || 'Email send failed' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
