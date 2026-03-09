const claudeProvider = require('./claudeProvider');
const openaiProvider = require('./openaiProvider');
const geminiProvider = require('./geminiProvider');
const openrouterProvider = require('./openrouterProvider');
const cliProvider = require('./cliProvider');
const { buildUserPrompt, getSystemPrompt } = require('./extractionPrompt');

const providers = {
  claude: claudeProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  openrouter: openrouterProvider,
  'claude-cli': cliProvider,
};

async function extractFromEmail(email, provider, apiKey, model) {
  const impl = providers[provider];
  if (!impl) throw new Error(`Unknown AI provider: ${provider}`);
  const result = await impl.extract(email, apiKey, model);
  const prompt = `[System]\n${getSystemPrompt()}\n\n[User]\n${buildUserPrompt(email)}`;
  return { suggestions: result.suggestions, prompt, rawResponse: result.rawResponse };
}

async function testProvider(provider, apiKey, model) {
  const impl = providers[provider];
  if (!impl) throw new Error(`Unknown AI provider: ${provider}`);
  return impl.test(apiKey, model);
}

module.exports = { extractFromEmail, testProvider };
