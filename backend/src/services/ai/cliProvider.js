const { spawn } = require('child_process');
const { getSystemPrompt, buildUserPrompt } = require('./extractionPrompt');

function getCleanEnv() {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  return env;
}

function runClaude(input) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', [
      '--print',
      '--output-format', 'text',
      '--max-turns', '1',
    ], {
      timeout: 120000,
      env: getCleanEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => stdout += d);
    child.stderr.on('data', d => stderr += d);

    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || `claude exited with code ${code}`));
      resolve(stdout);
    });

    child.on('error', reject);

    child.stdin.write(input);
    child.stdin.end();
  });
}

function extractJSON(text) {
  // Try parsing directly
  try { return JSON.parse(text); } catch (e) {}

  // Try extracting from code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch (e) {}
  }

  // Try finding JSON object in text
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

  const output = await runClaude(fullPrompt);
  const parsed = extractJSON(output);
  const sentiment = (parsed && parsed.sentiment) ? parsed.sentiment : { label: 'neutral', confidence: 0, reasoning: 'No sentiment returned' };
  const suggestions = (parsed && Array.isArray(parsed.suggestions)) ? parsed.suggestions : [];
  return { sentiment, suggestions, rawResponse: output };
}

async function test(apiKey, model) {
  const output = await runClaude('Say "connected" in one word.');
  if (output.toLowerCase().includes('connected')) {
    return 'Claude CLI connection successful';
  }
  return 'Claude CLI responded: ' + output.substring(0, 50);
}

module.exports = { extract, test };
