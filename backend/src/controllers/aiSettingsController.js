const { getDb } = require('../db/connection');

function maskKey(key) {
  if (!key || key.length < 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

function get(req, res) {
  const db = getDb();
  const settings = db.prepare('SELECT * FROM ai_settings ORDER BY id').all();
  const masked = settings.map(s => ({ ...s, api_key: maskKey(s.api_key) }));
  res.json(masked);
}

function getPrompt(req, res) {
  const db = getDb();
  const { DEFAULT_PROMPT } = require('../services/ai/extractionPrompt');
  const active = db.prepare('SELECT custom_prompt FROM ai_settings WHERE is_active = 1 LIMIT 1').get();
  res.json({
    custom_prompt: active?.custom_prompt || '',
    default_prompt: DEFAULT_PROMPT,
  });
}

function updatePrompt(req, res) {
  const db = getDb();
  const { custom_prompt } = req.body;
  const active = db.prepare('SELECT id FROM ai_settings WHERE is_active = 1 LIMIT 1').get();
  if (!active) return res.status(400).json({ error: 'No active AI provider' });

  db.prepare("UPDATE ai_settings SET custom_prompt = ?, updated_at = datetime('now') WHERE id = ?")
    .run(custom_prompt || null, active.id);
  res.json({ success: true });
}

function update(req, res) {
  const db = getDb();
  const { provider, api_key, model, is_active } = req.body;

  if (!provider) return res.status(400).json({ error: 'Provider is required' });

  const existing = db.prepare('SELECT * FROM ai_settings WHERE provider = ?').get(provider);

  if (existing) {
    const updates = [];
    const params = [];
    if (api_key !== undefined && !api_key.includes('****')) {
      updates.push('api_key = ?');
      params.push(api_key);
    }
    if (model !== undefined) {
      updates.push('model = ?');
      params.push(model);
    }
    if (is_active !== undefined) {
      // If activating this provider, deactivate others
      if (is_active) {
        db.prepare('UPDATE ai_settings SET is_active = 0').run();
      }
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }
    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(existing.id);
      db.prepare(`UPDATE ai_settings SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
  } else {
    // If activating, deactivate others first
    if (is_active) {
      db.prepare('UPDATE ai_settings SET is_active = 0').run();
    }
    db.prepare('INSERT INTO ai_settings (provider, api_key, model, is_active) VALUES (?, ?, ?, ?)').run(
      provider, api_key || '', model || '', is_active ? 1 : 0
    );
  }

  const updated = db.prepare('SELECT * FROM ai_settings WHERE provider = ?').get(provider);
  res.json({ ...updated, api_key: maskKey(updated.api_key) });
}

async function testConnection(req, res) {
  const db = getDb();
  const { provider } = req.body;
  if (!provider) return res.status(400).json({ error: 'Provider is required' });

  const settings = db.prepare('SELECT * FROM ai_settings WHERE provider = ?').get(provider);
  if (!settings || !settings.api_key) {
    return res.status(400).json({ error: 'No API key configured for this provider' });
  }

  try {
    const { testProvider } = require('../services/ai/provider');
    const result = await testProvider(settings.provider, settings.api_key, settings.model);
    res.json({ success: true, message: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

module.exports = { get, getPrompt, update, updatePrompt, testConnection };
