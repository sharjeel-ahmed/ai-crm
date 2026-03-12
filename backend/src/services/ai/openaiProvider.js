const https = require('https');
const { getSystemPrompt, OUTPUT_SCHEMA, buildUserPrompt } = require('./extractionPrompt');

async function extract(email, apiKey, model) {
  const userPrompt = buildUserPrompt(email);
  const body = JSON.stringify({
    model: model || 'gpt-4o',
    max_tokens: 4096,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'crm_extraction', schema: OUTPUT_SCHEMA, strict: true }
    },
    messages: [
      { role: 'system', content: getSystemPrompt() },
      { role: 'user', content: userPrompt }
    ]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const content = parsed.choices?.[0]?.message?.content;
          let sentiment = { label: 'neutral', confidence: 0, reasoning: 'No sentiment returned' };
          let suggestions = [];
          if (content) {
            const result = JSON.parse(content);
            sentiment = result.sentiment || sentiment;
            suggestions = result.suggestions || [];
          }
          resolve({ sentiment, suggestions, rawResponse: data });
        } catch (e) {
          reject(new Error('Failed to parse OpenAI response'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function test(apiKey, model) {
  const body = JSON.stringify({
    model: model || 'gpt-4o',
    max_tokens: 50,
    messages: [{ role: 'user', content: 'Say "connected" in one word.' }]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.error) return reject(new Error(parsed.error.message));
        resolve('OpenAI connection successful');
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { extract, test };
