const { getDb } = require('../db/connection');
const { getEffectiveClientId } = require('../utils/tenant');

function getRules(req, res) {
  const db = getDb();
  const clientId = getEffectiveClientId(req, db);
  const rules = db.prepare('SELECT * FROM auto_approve_rules WHERE client_id = ? ORDER BY suggestion_type').all(clientId);
  res.json(rules);
}

function updateRule(req, res) {
  const db = getDb();
  const { suggestion_type, confidence_threshold, is_enabled } = req.body;
  const clientId = getEffectiveClientId(req, db);

  if (!suggestion_type) return res.status(400).json({ error: 'suggestion_type is required' });

  const existing = db.prepare('SELECT * FROM auto_approve_rules WHERE client_id = ? AND suggestion_type = ?').get(clientId, suggestion_type);

  if (existing) {
    db.prepare(
      "UPDATE auto_approve_rules SET confidence_threshold = ?, is_enabled = ?, updated_at = datetime('now') WHERE client_id = ? AND suggestion_type = ?"
    ).run(
      confidence_threshold !== undefined ? confidence_threshold : existing.confidence_threshold,
      is_enabled !== undefined ? (is_enabled ? 1 : 0) : existing.is_enabled,
      clientId,
      suggestion_type
    );
  } else {
    db.prepare(
      'INSERT INTO auto_approve_rules (client_id, suggestion_type, confidence_threshold, is_enabled) VALUES (?, ?, ?, ?)'
    ).run(clientId, suggestion_type, confidence_threshold || 0.95, is_enabled ? 1 : 0);
  }

  const updated = db.prepare('SELECT * FROM auto_approve_rules WHERE client_id = ? AND suggestion_type = ?').get(clientId, suggestion_type);
  res.json(updated);
}

module.exports = { getRules, updateRule };
