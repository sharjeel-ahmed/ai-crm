const crypto = require('crypto');
const { getDb } = require('../db/connection');

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-API-Key header' });
  }

  const db = getDb();
  const hash = hashKey(apiKey);

  const row = db.prepare(`
    SELECT ak.id as key_id, u.id, u.name, u.email, u.role
    FROM api_keys ak
    JOIN users u ON u.id = ak.user_id
    WHERE ak.key_hash = ? AND ak.is_active = 1 AND u.is_active = 1
  `).get(hash);

  if (!row) {
    return res.status(401).json({ error: 'Invalid or revoked API key' });
  }

  // Update last_used_at (fire and forget)
  db.prepare('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?').run(row.key_id);

  req.user = { id: row.id, name: row.name, email: row.email, role: row.role };
  next();
}

module.exports = { apiKeyAuth };
