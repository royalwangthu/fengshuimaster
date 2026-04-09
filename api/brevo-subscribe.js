export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const API_KEY = process.env.MAILERLITE_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'Mailerlite not configured' });
  }

  try {
    const { email, name, score, element, birthYear } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'No email provided' });
    }

    const GROUP_ID = '184253245449832257';

    // Step 1: Create/update subscriber
    const resp = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        email: email,
        groups: [GROUP_ID],
        fields: {
          name: name || '',
          last_name: '',
          fengshui_score: String(score || ''),
          element: element || '',
          birth_year: String(birthYear || ''),
          signup_source: 'report'
        }
      })
    });

    const data = await resp.json();

    if (resp.ok || resp.status === 200 || resp.status === 201) {
      return res.status(200).json({ success: true });
    }

    return res.status(resp.status).json({ error: data.message || 'Mailerlite API error' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
