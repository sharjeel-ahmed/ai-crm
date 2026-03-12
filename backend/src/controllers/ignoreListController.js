const { getDb } = require('../db/connection');

function normalizeEmailAddress(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const match = trimmed.match(/<([^>]+)>/);
  return (match ? match[1] : trimmed).trim().toLowerCase() || null;
}

function parseEmailArray(value) {
  if (!value) return [];
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value.split(',');
    }
  }

  const values = Array.isArray(parsed) ? parsed : [parsed];
  return values.map(normalizeEmailAddress).filter(Boolean);
}

function getAll(req, res) {
  const db = getDb();
  const list = db.prepare('SELECT * FROM email_ignore_list ORDER BY created_at DESC').all();
  res.json(list);
}

function add(req, res) {
  const { email_address, reason } = req.body;
  if (!email_address) return res.status(400).json({ error: 'Email address required' });

  const db = getDb();
  const normalized = normalizeEmailAddress(email_address);
  if (!normalized) return res.status(400).json({ error: 'Email address required' });

  const existing = db.prepare('SELECT id FROM email_ignore_list WHERE LOWER(email_address) = ?').get(normalized);
  if (existing) return res.status(400).json({ error: 'Email already in ignore list' });

  const result = db.prepare('INSERT INTO email_ignore_list (email_address, reason) VALUES (?, ?)').run(normalized, reason || null);
  const unprocessedEmails = db.prepare('SELECT id, from_address, to_addresses FROM emails WHERE ai_processed = 0').all();
  const skipStmt = db.prepare('UPDATE emails SET ai_processed = 1 WHERE id = ?');

  for (const email of unprocessedEmails) {
    const fromAddress = normalizeEmailAddress(email.from_address);
    const toAddresses = parseEmailArray(email.to_addresses);
    if (fromAddress === normalized || toAddresses.includes(normalized)) {
      skipStmt.run(email.id);
    }
  }

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
