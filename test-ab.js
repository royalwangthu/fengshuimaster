// A/B Test Script — 33 runs via curl (proxy-friendly)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');
require('dotenv').config({ path: '.env.local' });

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
const TOTAL_RUNS = 33;

const IMG_DIR = path.join(process.env.HOME, 'Downloads/户型测试');
const imgFiles = fs.readdirSync(IMG_DIR).filter(f => /\.(png|jpe?g)$/i.test(f));
console.log(`Found ${imgFiles.length} test images:`, imgFiles);

const directions = ['North','South','East','West','Northeast','Northwest','Southeast','Southwest'];
const focuses = ['Wealth','Love','Career','Health','Family','Clarity'];
const profiles = [
  { dob: '1990-03-15', hour: '8', location: 'New York, USA' },
  { dob: '1985-07-22', hour: '14', location: 'London, UK' },
  { dob: '1978-11-03', hour: '6', location: 'Beijing, China' },
  { dob: '1995-01-28', hour: '20', location: 'Sydney, Australia' },
  { dob: '1982-09-10', hour: '11', location: 'Toronto, Canada' },
  { dob: '1970-05-18', hour: '16', location: 'Berlin, Germany' },
  { dob: '2000-12-25', hour: '3', location: 'Tokyo, Japan' },
  { dob: '1988-04-07', hour: '9', location: 'Mumbai, India' },
];

const REQUIRED = ['score','headline','description','rooms','remedies','plants','elements','zones','roomPositions'];
const today = new Date().toISOString().split('T')[0];

function buildPrompt(profile, direction, focus) {
  const userContext = `Birth date: ${profile.dob}, Birth hour: ${profile.hour}:00, Location: ${profile.location}, Home facing direction: ${direction}, Focus area: ${focus}`;
  const sys = 'You are FengShuiMaster, a world-class feng shui master using the Eight Mansions (八宅明镜) system.\n\n'
    + 'Calculate Life Gua, House Gua, map 8 positions, and SCORE using weighted formula (Bedroom 30pts, Door 25pts, Office 20pts, Gua match 15pts, Kitchen/Bath 10pts). '
    + 'Score max 92.\n\n'
    + 'Write in ENGLISH. Poetic, warm, mind-body-spirit style.\n\n'
    + 'Return ONLY valid JSON:\n'
    + '{"score":0,"headline":"max 8 words","description":"2-3 sentences with Gua calc","subtitle":"","quote":"","roomPositions":{"bedroom":"SE","office":"N","living":"E","kitchen":"SW","bathroom":"NW"},"flow":{"title":"","desc":""},"zones":{"wealth":0,"love":0,"career":0,"family":0},"elements":{"wood":{"score":0,"state":""},"fire":{"score":0,"state":""},"earth":{"score":0,"state":""},"metal":{"score":0,"state":""},"water":{"score":0,"state":""}},"kpis":[{"label":"Clarity & Intuition","value":0},{"label":"Well-being & Vitality","value":0},{"label":"Career Prosperity","value":0}],"rooms":[{"type":"strength","name":"","headline":"","body":"2 sentences","tag":""},{"type":"strength","name":"","headline":"","body":"","tag":""},{"type":"strength","name":"","headline":"","body":"","tag":""},{"type":"improvement","name":"","headline":"","body":"","impact":"","tag":""},{"type":"improvement","name":"","headline":"","body":"","impact":"","tag":""},{"type":"improvement","name":"","headline":"","body":"","impact":"","tag":""}],"remedies":[{"title":"","body":"1-2 sentences","tag":"Urgent"},{"title":"","body":"","tag":"High Impact"},{"title":"","body":"","tag":"Essential"},{"title":"","body":"","tag":"Recommended"},{"title":"","body":"","tag":"Balance"}],"plants":[{"icon":"🌿","name":"","zone":"","body":""},{"icon":"🎋","name":"","zone":"","body":""},{"icon":"🌸","name":"","zone":"","body":""},{"icon":"🪴","name":"","zone":"","body":""}],"dates":{"title":"","best":{"month":"","day":"","weekday":"","time":"","reason":"","tags":[]},"secondary":[{"month":"","day":"","weekday":""},{"month":"","day":"","weekday":""},{"month":"","day":"","weekday":""},{"month":"","day":"","weekday":""}]},"shareCard":{"status":"","headline":"","sub":"","topRemedy":"","zones":[{"label":"Wealth","direction":"","value":0,"status":""},{"label":"Career","direction":"","value":0,"status":""},{"label":"Health","direction":"","value":0,"status":""},{"label":"Love","direction":"","value":0,"status":""}]}}\n\n'
    + 'RULES: All values 0-100. Score ≤ 92. 6 rooms, 5 remedies, 4 plants, 5 dates, 4 shareCard zones. Today: ' + today;
  return { sys, userContext };
}

async function runTest(idx) {
  const imgFile = imgFiles[idx % imgFiles.length];
  const profile = profiles[idx % profiles.length];
  const direction = directions[idx % directions.length];
  const focus = focuses[idx % focuses.length];
  const { sys, userContext } = buildPrompt(profile, direction, focus);

  // Compress image
  const imgBuf = await sharp(path.join(IMG_DIR, imgFile))
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 50 })
    .toBuffer();
  const b64 = imgBuf.toString('base64');

  const geminiBody = {
    contents: [{ parts: [
      { text: sys + '\n\nUser data:\n' + userContext + '\n\nA floor plan image is attached.' },
      { inlineData: { mimeType: 'image/jpeg', data: b64 } }
    ]}],
    generationConfig: { temperature: 1.4, maxOutputTokens: 16384, responseMimeType: 'application/json' }
  };

  const tmpFile = `/tmp/gemini_test_${idx}.json`;
  fs.writeFileSync(tmpFile, JSON.stringify(geminiBody));

  const MAX_RETRIES = 3;
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = execSync(
        `curl -s --max-time 60 -X POST "${GEMINI_URL}" -H "Content-Type: application/json" -d @${tmpFile}`,
        { maxBuffer: 50 * 1024 * 1024, timeout: 65000 }
      ).toString();

      const geminiResp = JSON.parse(result);
      let text = '';
      if (geminiResp.candidates?.[0]?.content?.parts?.[0]?.text) {
        text = geminiResp.candidates[0].content.parts[0].text;
      } else if (geminiResp.error) {
        throw new Error(`API: ${geminiResp.error.message?.substring(0, 100)}`);
      } else {
        throw new Error('Empty response');
      }

      text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      let data;
      try {
        data = JSON.parse(text);
      } catch(e) {
        let repaired = text;
        const opens = (repaired.match(/\[/g)||[]).length - (repaired.match(/\]/g)||[]).length;
        const braces = (repaired.match(/\{/g)||[]).length - (repaired.match(/\}/g)||[]).length;
        repaired = repaired.replace(/,\s*$/, '').replace(/,\s*"[^"]*"?\s*$/, '');
        repaired = repaired.replace(/:\s*"[^"]*$/, ': ""').replace(/:\s*$/, ': null');
        for (let i = 0; i < opens; i++) repaired += ']';
        for (let i = 0; i < braces; i++) repaired += '}';
        data = JSON.parse(repaired);
      }

      const missing = REQUIRED.filter(f => !data[f] || (Array.isArray(data[f]) && data[f].length === 0));
      if (missing.length > 0) throw new Error(`Truncated: missing ${missing.join(', ')}`);
      if (data.rooms.length < 6) throw new Error(`Only ${data.rooms.length} rooms`);
      if (data.remedies.length < 5) throw new Error(`Only ${data.remedies.length} remedies`);

      fs.unlinkSync(tmpFile);
      return {
        idx, attempt, status: 'SUCCESS', score: data.score,
        headline: data.headline, img: imgFile,
        profile: `${profile.dob} / ${direction} / ${focus}`,
        rooms: data.rooms.length, remedies: data.remedies.length, plants: data.plants.length,
      };
    } catch(err) {
      lastError = err.message;
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 2000));
    }
  }

  try { fs.unlinkSync(tmpFile); } catch(e) {}
  return {
    idx, attempt: MAX_RETRIES, status: 'FAIL', error: lastError,
    img: imgFile, profile: `${profile.dob} / ${direction} / ${focus}`,
  };
}

async function main() {
  console.log(`\n🔬 Starting ${TOTAL_RUNS} A/B tests...\n`);
  const startTime = Date.now();
  const results = [];
  const headlines = new Set();

  // Run sequentially to avoid rate limits
  for (let i = 0; i < TOTAL_RUNS; i++) {
    const r = await runTest(i);
    results.push(r);
    const icon = r.status === 'SUCCESS' ? '✓' : '✗';
    const detail = r.status === 'SUCCESS'
      ? `Score:${r.score} | "${r.headline}" | R:${r.rooms} Rem:${r.remedies} P:${r.plants}`
      : `ERROR: ${r.error}`;
    console.log(`  ${icon} #${String(i + 1).padStart(2)} [${r.img}] ${r.profile} → ${detail} (attempt ${r.attempt})`);
    if (r.headline) headlines.add(r.headline);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const successes = results.filter(r => r.status === 'SUCCESS');
  const failures = results.filter(r => r.status === 'FAIL');
  const scores = successes.map(r => r.score);
  const duplicateHeadlines = successes.length - headlines.size;

  console.log('\n' + '═'.repeat(60));
  console.log(`RESULTS: ${TOTAL_RUNS} tests in ${elapsed}s`);
  console.log('═'.repeat(60));
  console.log(`  ✓ Success: ${successes.length}/${TOTAL_RUNS} (${(successes.length/TOTAL_RUNS*100).toFixed(1)}%)`);
  console.log(`  ✗ Fail:    ${failures.length}/${TOTAL_RUNS}`);
  if (scores.length) {
    console.log(`  Scores:    min=${Math.min(...scores)} max=${Math.max(...scores)} avg=${(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1)}`);
  }
  console.log(`  Unique headlines: ${headlines.size} / Duplicate: ${duplicateHeadlines}`);

  if (failures.length > 0) {
    console.log('\nFAILURES:');
    failures.forEach(f => console.log(`  #${f.idx + 1}: ${f.error} [${f.img}] ${f.profile}`));
  }

  fs.writeFileSync(path.join(IMG_DIR, 'test-results.json'), JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${path.join(IMG_DIR, 'test-results.json')}`);
}

main().catch(console.error);
