export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const BREVO_KEY = process.env.BREVO_API_KEY;
  const LIST_ID = parseInt(process.env.BREVO_LIST_ID || '2', 10);

  if (!BREVO_KEY) {
    return res.status(500).json({ error: 'Brevo not configured' });
  }

  try {
    const { email, name, score, element, birthYear } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'No email provided' });
    }

    const resp = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_KEY
      },
      body: JSON.stringify({
        email: email,
        listIds: [LIST_ID],
        attributes: {
          FIRSTNAME: name || '',
          FENGSHUI_SCORE: score || '',
          ELEMENT: element || '',
          BIRTH_YEAR: birthYear || '',
          SIGNUP_SOURCE: 'report'
        },
        updateEnabled: true
      })
    });

    if (resp.status === 204 || resp.status === 201) {
      return res.status(200).json({ success: true });
    }

    const data = await resp.json();

    if (data.code === 'duplicate_parameter') {
      return res.status(200).json({ success: true, existing: true });
    }

    return res.status(resp.status).json({ error: data.message || 'Brevo API error' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
