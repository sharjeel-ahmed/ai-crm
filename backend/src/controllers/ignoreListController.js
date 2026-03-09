const { getDb } = require('../db/connection');

function getAll(req, res) {
  const db = getDb();
  const list = db.prepare('SELECT * FROM email_ignore_list ORDER BY created_at DESC').all();
  res.json(list);
}

function add(req, res) {
  const { email_address, reason } = req.body;
  if (!email_address) return res.status(400).json({ error: 'Email address required' });

  const db = getDb();
  const normalized = email_address.trim().toLowerCase();

  const existing = db.prepare('SELECT id FROM email_ignore_list WHERE LOWER(email_address) = ?').get(normalized);
  if (existing) return res.status(400).json({ error: 'Email already in ignore list' });

  const result = db.prepare('INSERT INTO email_ignore_list (email_address, reason) VALUES (?, ?)').run(normalized, reason || null);
  const entry = db.prepare('SELECT * FROM email_ignore_list WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(entry);
}

function remove(req, res) {
  const db = getDb();
  const result = db.prepare('DELETE FROM email_ignore_list WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Entry not found' });
  res.json({ message: 'Removed from ignore list' });
}

module.exports = { getAll, add, remove };
