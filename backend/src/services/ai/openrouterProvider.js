const https = require('https');
const { getSystemPrompt, buildUserPrompt } = require('./extractionPrompt');

async function extract(email, apiKey, model) {
  const userPrompt = buildUserPrompt(email);
  const body = JSON.stringify({
    model: model || 'anthropic/claude-sonnet-4',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: getSystemPrompt() + '\n\nRespond with a JSON object containing a "suggestions" array.' },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' }
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'Pazo CRM'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
          const content = parsed.choices?.[0]?.message?.content;
          let suggestions = [];
          if (content) {
            const result = JSON.parse(content);
            suggestions = result.suggestions || [];
          }
          resolve({ suggestions, rawResponse: data });
        } catch (e) {
          reject(new Error('Failed to parse OpenRouter response'));
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
    model: model || 'anthropic/claude-sonnet-4',
    max_tokens: 50,
    messages: [{ role: 'user', content: 'Say "connected" in one word.' }]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'Pazo CRM'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.error) return reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
        resolve('OpenRouter connection successful');
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { extract, test };
