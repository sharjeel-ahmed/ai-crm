const { getDb } = require('../db/connection');

function scopeQuery(req) {
  if (req.user.role === 'sales_rep') {
    return { where: 'AND ct.owner_id = ?', params: [req.user.id] };
  }
  return { where: '', params: [] };
}

function getAll(req, res) {
  const db = getDb();
  const scope = scopeQuery(req);
  const contacts = db.prepare(`
    SELECT ct.*, c.name as company_name, u.name as owner_name, p.name as partner_name
    FROM contacts ct
    LEFT JOIN companies c ON ct.company_id = c.id
    LEFT JOIN users u ON ct.owner_id = u.id
    LEFT JOIN partners p ON ct.partner_id = p.id
    WHERE 1=1 ${scope.where}
    ORDER BY ct.last_name, ct.first_name
  `).all(...scope.params);
  res.json(contacts);
}

function getById(req, res) {
  const db = getDb();
  const contact = db.prepare(`
    SELECT ct.*, c.name as company_name, u.name as owner_name
    FROM contacts ct
    LEFT JOIN companies c ON ct.company_id = c.id
    LEFT JOIN users u ON ct.owner_id = u.id
    WHERE ct.id = ?
  `).get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  res.json(contact);
}

function create(req, res) {
  const { first_name, last_name, email, phone, job_title, company_id } = req.body;
  if (!first_name || !last_name) return res.status(400).json({ error: 'First and last name required' });

  const db = getDb();
  const result = db.prepare('INSERT INTO contacts (first_name, last_name, email, phone, job_title, company_id, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(first_name, last_name, email || null, phone || null, job_title || null, company_id || null, req.user.id);
  const contact = db.prepare(`
    SELECT ct.*, c.name as company_name
    FROM contacts ct
    LEFT JOIN companies c ON ct.company_id = c.id
    WHERE ct.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(contact);
}

function update(req, res) {
  const { first_name, last_name, email, phone, job_title, company_id, owner_id, partner_id } = req.body;
  const db = getDb();
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  db.prepare(`UPDATE contacts SET first_name = ?, last_name = ?, email = ?, phone = ?, job_title = ?, company_id = ?, owner_id = ?, partner_id = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(
      first_name || contact.first_name, last_name || contact.last_name,
      email !== undefined ? email : contact.email, phone !== undefined ? phone : contact.phone,
      job_title !== undefined ? job_title : contact.job_title,
      company_id !== undefined ? company_id : contact.company_id,
      owner_id !== undefined ? owner_id : contact.owner_id,
      partner_id !== undefined ? (partner_id || null) : contact.partner_id,
      req.params.id
    );
  const updated = db.prepare(`
    SELECT ct.*, c.name as company_name, u.name as owner_name
    FROM contacts ct LEFT JOIN companies c ON ct.company_id = c.id
    LEFT JOIN users u ON ct.owner_id = u.id WHERE ct.id = ?
  `).get(req.params.id);
  res.json(updated);
}

function remove(req, res) {
  const db = getDb();
  const result = db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Contact not found' });
  res.json({ message: 'Contact deleted' });
}

module.exports = { getAll, getById, create, update, remove };
