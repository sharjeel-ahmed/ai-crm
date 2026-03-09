const { getDb } = require('../db/connection');

function getRules(req, res) {
  const db = getDb();
  const rules = db.prepare('SELECT * FROM auto_approve_rules ORDER BY suggestion_type').all();
  res.json(rules);
}

function updateRule(req, res) {
  const db = getDb();
  const { suggestion_type, confidence_threshold, is_enabled } = req.body;

  if (!suggestion_type) return res.status(400).json({ error: 'suggestion_type is required' });

  const existing = db.prepare('SELECT * FROM auto_approve_rules WHERE suggestion_type = ?').get(suggestion_type);

  if (existing) {
    db.prepare(
      "UPDATE auto_approve_rules SET confidence_threshold = ?, is_enabled = ?, updated_at = datetime('now') WHERE suggestion_type = ?"
    ).run(
      confidence_threshold !== undefined ? confidence_threshold : existing.confidence_threshold,
      is_enabled !== undefined ? (is_enabled ? 1 : 0) : existing.is_enabled,
      suggestion_type
    );
  } else {
    db.prepare(
      'INSERT INTO auto_approve_rules (suggestion_type, confidence_threshold, is_enabled) VALUES (?, ?, ?)'
    ).run(suggestion_type, confidence_threshold || 0.95, is_enabled ? 1 : 0);
  }

  const updated = db.prepare('SELECT * FROM auto_approve_rules WHERE suggestion_type = ?').get(suggestion_type);
  res.json(updated);
}

module.exports = { getRules, updateRule };
