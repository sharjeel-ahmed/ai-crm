const crypto = require('crypto');
const { getDb } = require('../db/connection');

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateKey() {
  return 'pzo_' + crypto.randomBytes(16).toString('hex');
}

function createKey(req, res) {
  const { name, user_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const targetUserId = (req.user.role === 'admin' && user_id) ? user_id : req.user.id;
  const fullKey = generateKey();
  const prefix = fullKey.substring(0, 12);
  const hash = hashKey(fullKey);

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO api_keys (user_id, key_prefix, key_hash, name) VALUES (?, ?, ?, ?)'
  ).run(targetUserId, prefix, hash, name);

  res.status(201).json({
    id: result.lastInsertRowid,
    key: fullKey,
    prefix,
    name,
    message: 'Store this key securely. It will not be shown again.'
  });
}

function listKeys(req, res) {
  const db = getDb();
  let rows;
  if (req.user.role === 'admin') {
    rows = db.prepare(`
      SELECT ak.id, ak.key_prefix, ak.name, ak.is_active, ak.last_used_at, ak.created_at, ak.revoked_at,
             u.name as user_name, u.email as user_email
      FROM api_keys ak JOIN users u ON u.id = ak.user_id
      ORDER BY ak.created_at DESC
    `).all();
  } else {
    rows = db.prepare(`
      SELECT id, key_prefix, name, is_active, last_used_at, created_at, revoked_at
      FROM api_keys WHERE user_id = ? ORDER BY created_at DESC
    `).all(req.user.id);
  }
  res.json(rows);
}

function revokeKey(req, res) {
  const db = getDb();
  const key = db.prepare('SELECT id, user_id FROM api_keys WHERE id = ?').get(req.params.id);
  if (!key) return res.status(404).json({ error: 'API key not found' });

  if (req.user.role !== 'admin' && key.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Cannot revoke another user\'s key' });
  }

  db.prepare("UPDATE api_keys SET is_active = 0, revoked_at = datetime('now') WHERE id = ?").run(key.id);
  res.json({ message: 'API key revoked' });
}

module.exports = { createKey, listKeys, revokeKey };
