const { spawn } = require('child_process');
const { getSystemPrompt, buildUserPrompt } = require('./extractionPrompt');

function runCodex(input, model) {
  return new Promise((resolve, reject) => {
    const args = [
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--ignore-user-config',
    ];

    if (model) {
      args.push('--model', model);
    }

    const child = spawn('codex', args, {
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });

    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || `codex exited with code ${code}`));
      resolve(stdout);
    });

    child.on('error', reject);

    child.stdin.write(input);
    child.stdin.end();
  });
}

function extractFinalMessage(output) {
  const lines = String(output || '').split(/\r?\n/).filter(Boolean);
  let lastMessage = '';

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.type === 'item.completed' && event.item?.type === 'agent_message' && typeof event.item.text === 'string') {
        lastMessage = event.item.text;
      }
    } catch {
      // Ignore non-JSON lines.
    }
  }

  return lastMessage || output;
}

function extractJSON(text) {
  try { return JSON.parse(text); } catch (e) {}

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch (e) {}
  }

  const jsonMatch = text.match(/\{[\s\S]*"sentiment"[\s\S]*"suggestions"[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch (e) {}
  }

  return null;
}

async function extract(email, apiKey, model) {
  const systemPrompt = getSystemPrompt();
  const userPrompt = buildUserPrompt(email);
  const fullPrompt = `${systemPrompt}\n\nIMPORTANT: Respond ONLY with a valid JSON object containing top-level "sentiment" and "suggestions" fields. No markdown, no code fences, no explanation — just raw JSON.\n\n${userPrompt}`;

  const output = await runCodex(fullPrompt, model);
  const finalMessage = extractFinalMessage(output);
  const parsed = extractJSON(finalMessage);
  const sentiment = (parsed && parsed.sentiment) ? parsed.sentiment : { label: 'neutral', confidence: 0, reasoning: 'No sentiment returned' };
  const suggestions = (parsed && Array.isArray(parsed.suggestions)) ? parsed.suggestions : [];
  return { sentiment, suggestions, rawResponse: output };
}

async function test(apiKey, model) {
  const output = await runCodex('Say "connected" in one word.', model);
  const finalMessage = extractFinalMessage(output).toLowerCase();
  if (finalMessage.includes('connected')) {
    return 'Codex CLI connection successful';
  }
  return 'Codex CLI responded: ' + extractFinalMessage(output).substring(0, 50);
}

module.exports = { extract, test };
