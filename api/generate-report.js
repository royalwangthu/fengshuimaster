export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { sessionId, geminiBody } = req.body;

    // ── Verify payment ──
    const ADMIN_KEY = process.env.ADMIN_KEY || '';

    if (sessionId === 'direct') {
      // Direct mode requires admin key
      const { adminKey } = req.body;
      if (!ADMIN_KEY || adminKey !== ADMIN_KEY) {
        return res.status(403).json({ error: 'Payment required' });
      }
    } else if (sessionId && sessionId.startsWith('cs_test_')) {
      // TEMP: bypass verification for Stripe test mode sessions
    } else if (STRIPE_SECRET && sessionId) {
      const stripeResp = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
        { headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` } }
      );
      const session = await stripeResp.json();

      if (!stripeResp.ok || session.payment_status !== 'paid') {
        return res.status(403).json({ error: 'Payment not verified' });
      }
    } else {
      return res.status(403).json({ error: 'Payment required' });
    }

    // ── Call Gemini API server-side ──
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000); // 55s (Vercel Pro = 60s)

    const geminiResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      return res.status(geminiResp.status).json({ error: 'Gemini API error: ' + errText.substring(0, 500) });
    }

    const geminiData = await geminiResp.json();
    return res.status(200).json(geminiData);
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? 'Gemini API timed out' : err.message
    });
  }
}
