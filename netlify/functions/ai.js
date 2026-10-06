// AI API: PIN-protected proxy to Gemini (key stays server-side).
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const VOICE = process.env.GEMINI_VOICE || 'Aoede'; // female voice; also try Kore, Leda, Zephyr

const json = (status, body) => ({ statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function gemini(model, body) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`); e.status = res.status; throw e; }
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!process.env.APP_PIN || event.headers['x-app-pin'] !== process.env.APP_PIN) return json(401, { error: 'Bad PIN' });
  if (!process.env.GEMINI_API_KEY) return json(500, { error: 'GEMINI_API_KEY is not set' });
  try {
    const { op, prompt, text } = JSON.parse(event.body || '{}');
    if (op === 'text' || op === 'json') {
      const r = await gemini(MODEL, {
        contents: [{ role: 'user', parts: [{ text: String(prompt || '').slice(0, 30000) }] }],
        generationConfig: { temperature: 0.4, thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 700, ...(op === 'json' ? { responseMimeType: 'application/json' } : {}) },
      });
      const out = r.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      if (op === 'text') return json(200, { text: out.trim() });
      return json(200, { data: JSON.parse(out) });
    }
    if (op === 'tts') {
      const r = await gemini(TTS_MODEL, {
        contents: [{ parts: [{ text: `Say warmly and clearly: ${String(text || '').slice(0, 3000)}` }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
      });
      const audio = r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audio) return json(502, { error: 'No audio returned' });
      return json(200, { audio, rate: 24000 });
    }
    return json(400, { error: 'Unknown op' });
  } catch (e) {
    return json(e.status === 429 ? 429 : 500, { error: String(e.message || e) });
  }
};
