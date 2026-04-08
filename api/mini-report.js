export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return res.status(500).json({ error: 'API key not configured' });

  try {
    const { direction, birthYear, focus } = req.body;
    if (!direction || !birthYear) {
      return res.status(400).json({ error: 'direction and birthYear are required' });
    }

    const today = new Date().toISOString().split('T')[0];
    const prompt = `You are FengShuiMaster. Generate a FREE mini feng shui report.

Input: Birth year: ${birthYear}, Home facing direction: ${direction}, Focus: ${focus || 'general'}

Calculate the Life Gua (Ming Gua) using Eight Mansions system:
- Male: (100 - last two digits of birth year) mod 9
- Female: (last two digits of birth year + 5) mod 9
- Mapping: 1=Kan 2=Kun 3=Zhen 4=Xun 5→Kun/Gen 6=Qian 7=Dui 8=Gen 9=Li
- Determine East/West group for person and house

Write in ENGLISH. Poetic, warm, mind-body-spirit style.

Return ONLY valid JSON:
{
  "score": 0,
  "headline": "max 8 words",
  "personality": {
    "title": "The [Element] — [Gua Name]",
    "text": "3-4 sentences describing their elemental archetype poetically"
  },
  "elements": {
    "wood": {"score": 0, "state": ""},
    "fire": {"score": 0, "state": ""},
    "earth": {"score": 0, "state": ""},
    "metal": {"score": 0, "state": ""},
    "water": {"score": 0, "state": ""}
  },
  "remedies": [
    {"title": "", "body": "1 sentence", "tag": "Urgent"},
    {"title": "", "body": "1 sentence", "tag": "High Impact"},
    {"title": "", "body": "1 sentence", "tag": "Essential"}
  ],
  "description": "1-2 sentences: Ming Gua number, group match, brief insight"
}

RULES: ALL number values MUST be non-zero. Element scores should range 20-95 based on the person's Gua and birth year element cycle. Score max 92. Element states: Rising/Waning/Dominant/Balanced/Needs Support. DO NOT leave any value as 0 — calculate real values based on Gua match and elemental interactions.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const geminiResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 1.2,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      return res.status(geminiResp.status).json({ error: 'Gemini API error: ' + errText.substring(0, 300) });
    }

    const geminiData = await geminiResp.json();
    return res.status(200).json(geminiData);
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? 'API timed out' : err.message
    });
  }
}
