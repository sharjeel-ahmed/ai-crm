const https = require('https');
const { getSystemPrompt, OUTPUT_SCHEMA, buildUserPrompt } = require('./extractionPrompt');

async function extract(email, apiKey, model) {
  const userPrompt = buildUserPrompt(email);
  const modelName = model || 'gemini-2.0-flash';
  const body = JSON.stringify({
    contents: [{ parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: getSystemPrompt() }] },
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: OUTPUT_SCHEMA
    }
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          let sentiment = { label: 'neutral', confidence: 0, reasoning: 'No sentiment returned' };
          let suggestions = [];
          if (text) {
            const result = JSON.parse(text);
            sentiment = result.sentiment || sentiment;
            suggestions = result.suggestions || [];
          }
          resolve({ sentiment, suggestions, rawResponse: data });
        } catch (e) {
          reject(new Error('Failed to parse Gemini response'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function test(apiKey, model) {
  const modelName = model || 'gemini-2.0-flash';
  const body = JSON.stringify({
    contents: [{ parts: [{ text: 'Say "connected" in one word.' }] }]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.error) return reject(new Error(parsed.error.message));
        resolve('Gemini connection successful');
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { extract, test };
