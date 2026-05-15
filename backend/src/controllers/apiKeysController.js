const crypto = require('crypto');
const { getDb } = require('../db/connection');
const { isGlobalAdmin } = require('../utils/tenant');

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateKey() {
  return 'pzo_' + crypto.randomBytes(16).toString('hex');
}

function createKey(req, res) {
  const { name, user_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const db = getDb();
  let targetUserId = req.user.id;
  if (req.user.role === 'admin' && user_id) {
    const targetUser = db.prepare('SELECT id, client_id FROM users WHERE id = ?').get(user_id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (!isGlobalAdmin(req.user) && targetUser.client_id !== req.user.client_id) {
      return res.status(403).json({ error: 'Cannot create keys for another client' });
    }
    targetUserId = targetUser.id;
  }
  const fullKey = generateKey();
  const prefix = fullKey.substring(0, 12);
  const hash = hashKey(fullKey);
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
  if (isGlobalAdmin(req.user)) {
    rows = db.prepare(`
      SELECT ak.id, ak.key_prefix, ak.name, ak.is_active, ak.last_used_at, ak.created_at, ak.revoked_at,
             u.name as user_name, u.email as user_email, u.client_id, c.name AS client_name
      FROM api_keys ak JOIN users u ON u.id = ak.user_id
      LEFT JOIN clients c ON c.id = u.client_id
      ORDER BY ak.created_at DESC
    `).all();
  } else if (req.user.role === 'admin') {
    rows = db.prepare(`
      SELECT ak.id, ak.key_prefix, ak.name, ak.is_active, ak.last_used_at, ak.created_at, ak.revoked_at,
             u.name as user_name, u.email as user_email
      FROM api_keys ak JOIN users u ON u.id = ak.user_id
      WHERE u.client_id = ?
      ORDER BY ak.created_at DESC
    `).all(req.user.client_id);
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
  const key = db.prepare(`
    SELECT ak.id, ak.user_id, u.client_id
    FROM api_keys ak
    JOIN users u ON u.id = ak.user_id
    WHERE ak.id = ?
  `).get(req.params.id);
  if (!key) return res.status(404).json({ error: 'API key not found' });

  if (req.user.role !== 'admin' && key.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Cannot revoke another user\'s key' });
  }
  if (req.user.role === 'admin' && !isGlobalAdmin(req.user) && key.client_id !== req.user.client_id) {
    return res.status(403).json({ error: 'Cannot revoke another client\'s key' });
  }

  db.prepare("UPDATE api_keys SET is_active = 0, revoked_at = datetime('now') WHERE id = ?").run(key.id);
  res.json({ message: 'API key revoked' });
}

module.exports = { createKey, listKeys, revokeKey };
