const https = require('https');
const { getSystemPrompt, OUTPUT_SCHEMA, buildUserPrompt } = require('./extractionPrompt');

async function extract(email, apiKey, model) {
  const userPrompt = buildUserPrompt(email);
  const body = JSON.stringify({
    model: model || 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: getSystemPrompt(),
    tools: [{
      name: 'extract_crm_data',
      description: 'Extract CRM-relevant data from the email',
      input_schema: OUTPUT_SCHEMA
    }],
    tool_choice: { type: 'tool', name: 'extract_crm_data' },
    messages: [{ role: 'user', content: userPrompt }]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const toolUse = parsed.content?.find(c => c.type === 'tool_use');
          const sentiment = toolUse?.input?.sentiment || { label: 'neutral', confidence: 0, reasoning: 'No sentiment returned' };
          const suggestions = toolUse?.input?.suggestions || [];
          resolve({ sentiment, suggestions, rawResponse: data });
        } catch (e) {
          reject(new Error('Failed to parse Claude response'));
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
    model: model || 'claude-sonnet-4-20250514',
    max_tokens: 50,
    messages: [{ role: 'user', content: 'Say "connected" in one word.' }]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.error) return reject(new Error(parsed.error.message));
        resolve('Claude connection successful');
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { extract, test };
