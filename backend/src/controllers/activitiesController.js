const { getDb } = require('../db/connection');

function getAll(req, res) {
  const db = getDb();
  const { deal_id, contact_id, type } = req.query;
  let where = '1=1';
  const params = [];

  if (deal_id) { where += ' AND a.deal_id = ?'; params.push(deal_id); }
  if (contact_id) { where += ' AND a.contact_id = ?'; params.push(contact_id); }
  if (type) { where += ' AND a.type = ?'; params.push(type); }

  if (req.user.role === 'sales_rep') {
    where += ' AND a.user_id = ?';
    params.push(req.user.id);
  }

  const activities = db.prepare(`
    SELECT a.*, u.name as user_name, d.title as deal_title,
      ct.first_name || ' ' || ct.last_name as contact_name
    FROM activities a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN deals d ON a.deal_id = d.id
    LEFT JOIN contacts ct ON a.contact_id = ct.id
    WHERE ${where}
    ORDER BY a.created_at DESC
  `).all(...params);
  res.json(activities);
}

function getById(req, res) {
  const db = getDb();
  const activity = db.prepare(`
    SELECT a.*, u.name as user_name, d.title as deal_title,
      ct.first_name || ' ' || ct.last_name as contact_name
    FROM activities a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN deals d ON a.deal_id = d.id
    LEFT JOIN contacts ct ON a.contact_id = ct.id
    WHERE a.id = ?
  `).get(req.params.id);
  if (!activity) return res.status(404).json({ error: 'Activity not found' });
  res.json(activity);
}

function create(req, res) {
  const { type, subject, description, due_date, deal_id, contact_id } = req.body;
  if (!type || !subject) return res.status(400).json({ error: 'Type and subject required' });

  const db = getDb();
  const result = db.prepare('INSERT INTO activities (type, subject, description, due_date, deal_id, contact_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(type, subject, description || null, due_date || null, deal_id || null, contact_id || null, req.user.id);
  const activity = db.prepare(`
    SELECT a.*, u.name as user_name
    FROM activities a LEFT JOIN users u ON a.user_id = u.id WHERE a.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(activity);
}

function update(req, res) {
  const { type, subject, description, due_date, is_completed, deal_id, contact_id } = req.body;
  const db = getDb();
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!activity) return res.status(404).json({ error: 'Activity not found' });

  db.prepare(`UPDATE activities SET type = ?, subject = ?, description = ?, due_date = ?, is_completed = ?, deal_id = ?, contact_id = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(
      type || activity.type, subject || activity.subject,
      description !== undefined ? description : activity.description,
      due_date !== undefined ? due_date : activity.due_date,
      is_completed !== undefined ? is_completed : activity.is_completed,
      deal_id !== undefined ? deal_id : activity.deal_id,
      contact_id !== undefined ? contact_id : activity.contact_id,
      req.params.id
    );
  const updated = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  res.json(updated);
}

function remove(req, res) {
  const db = getDb();
  const result = db.prepare('DELETE FROM activities WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Activity not found' });
  res.json({ message: 'Activity deleted' });
}

module.exports = { getAll, getById, create, update, remove };
