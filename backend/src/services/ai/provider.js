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

const ALLOWED_SUGGESTION_TYPES = new Set([
  'create_contact',
  'create_company',
  'create_deal',
  'log_activity',
  'update_contact',
  'move_deal_stage',
  'newsletter_detected',
]);

const ALLOWED_SENTIMENTS = new Set(['positive', 'negative', 'neutral']);

function clampConfidence(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

function sanitizeString(value, maxLength = 5000) {
  if (value === undefined || value === null) return value;
  return String(value).replace(/\0/g, '').trim().slice(0, maxLength);
}

function sanitizeData(value, depth = 0) {
  if (depth > 4) return null;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeData(item, depth + 1));
  if (typeof value === 'object') {
    const entries = Object.entries(value).slice(0, 50).map(([key, entryValue]) => [sanitizeString(key, 100), sanitizeData(entryValue, depth + 1)]);
    return Object.fromEntries(entries);
  }
  return sanitizeString(value);
}

function normalizeSentiment(sentiment) {
  const label = ALLOWED_SENTIMENTS.has(sentiment?.label) ? sentiment.label : 'neutral';
  return {
    label,
    confidence: clampConfidence(sentiment?.confidence),
    reasoning: sanitizeString(sentiment?.reasoning || 'No sentiment returned', 500),
  };
}

function normalizeSuggestions(suggestions) {
  if (!Array.isArray(suggestions)) return [];

  return suggestions
    .filter((suggestion) => ALLOWED_SUGGESTION_TYPES.has(suggestion?.type))
    .slice(0, 20)
    .map((suggestion) => ({
      type: suggestion.type,
      data: sanitizeData(suggestion.data),
      confidence: clampConfidence(suggestion.confidence),
      reasoning: sanitizeString(suggestion.reasoning || '', 500),
    }));
}

async function extractFromEmail(email, provider, apiKey, model) {
  const impl = providers[provider];
  if (!impl) throw new Error(`Unknown AI provider: ${provider}`);
  const result = await impl.extract(email, apiKey, model);
  const prompt = `[System]\n${getSystemPrompt()}\n\n[User]\n${buildUserPrompt(email)}`;
  return {
    sentiment: normalizeSentiment(result.sentiment),
    suggestions: normalizeSuggestions(result.suggestions),
    prompt,
    rawResponse: result.rawResponse,
  };
}

async function testProvider(provider, apiKey, model) {
  const impl = providers[provider];
  if (!impl) throw new Error(`Unknown AI provider: ${provider}`);
  return impl.test(apiKey, model);
}

module.exports = { extractFromEmail, testProvider };
