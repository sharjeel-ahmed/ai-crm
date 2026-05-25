const { getDb } = require('../db/connection');
const { getClientFilter, getEffectiveClientId } = require('../utils/tenant');

function scopeQuery(req) {
  if (req.user.role === 'sales_rep') {
    return { where: 'AND ct.owner_id = ?', params: [req.user.id] };
  }
  return { where: '', params: [] };
}

function getScopedContact(db, req, id) {
  let query = 'SELECT * FROM contacts WHERE id = ?';
  const params = [id];
  const clientFilter = getClientFilter(req);
  query += clientFilter.clause;
  params.push(...clientFilter.params);

  if (req.user.role === 'sales_rep') {
    query += ' AND owner_id = ?';
    params.push(req.user.id);
  }

  return db.prepare(query).get(...params);
}

function getOwnerById(db, ownerId) {
  if (!ownerId) return null;
  return db.prepare('SELECT id, client_id FROM users WHERE id = ? AND is_active = 1').get(ownerId);
}

function resolveOwnerId(db, ownerId, fallbackOwnerId, req) {
  const resolvedOwnerId = ownerId !== undefined && ownerId !== null && ownerId !== '' ? parseInt(ownerId, 10) : fallbackOwnerId;
  if (!resolvedOwnerId) {
    return { error: 'Owner is required' };
  }

  if (Number.isNaN(resolvedOwnerId)) {
    return { error: 'Owner must be a valid user' };
  }

  const owner = getOwnerById(db, resolvedOwnerId);
  if (!owner) {
    return { error: 'Selected owner was not found or is inactive' };
  }
  if (req.user.client_id && Number(owner.client_id) !== Number(req.user.client_id)) {
    return { error: 'Selected owner belongs to a different client' };
  }

  return { ownerId: resolvedOwnerId };
}

function getAll(req, res) {
  const db = getDb();
  const scope = scopeQuery(req);
  const clientFilter = getClientFilter(req, 'ct');
  const contacts = db.prepare(`
    SELECT ct.*, c.name as company_name, u.name as owner_name, p.name as partner_name
    FROM contacts ct
    LEFT JOIN companies c ON ct.company_id = c.id
    LEFT JOIN users u ON ct.owner_id = u.id
    LEFT JOIN partners p ON ct.partner_id = p.id
    WHERE 1=1 ${clientFilter.clause} ${scope.where}
    ORDER BY ct.last_name, ct.first_name
  `).all(...clientFilter.params, ...scope.params);
  res.json(contacts);
}

function getById(req, res) {
  const db = getDb();
  const scopedContact = getScopedContact(db, req, req.params.id);
  if (!scopedContact) return res.status(404).json({ error: 'Contact not found' });

  const contact = db.prepare(`
    SELECT ct.*, c.name as company_name, u.name as owner_name
    FROM contacts ct
    LEFT JOIN companies c ON ct.company_id = c.id
    LEFT JOIN users u ON ct.owner_id = u.id
    WHERE ct.id = ?
  `).get(scopedContact.id);
  res.json(contact);
}

function create(req, res) {
  const { first_name, last_name, email, phone, job_title, company_id } = req.body;
  if (!first_name || !last_name) return res.status(400).json({ error: 'First and last name required' });

  const db = getDb();
  const result = db.prepare('INSERT INTO contacts (first_name, last_name, email, phone, job_title, company_id, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(first_name, last_name, email || null, phone || null, job_title || null, company_id || null, req.user.id);
  db.prepare('UPDATE contacts SET client_id = ? WHERE id = ?').run(getEffectiveClientId(req, db), result.lastInsertRowid);
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
  const contact = getScopedContact(db, req, req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const ownerResolution = resolveOwnerId(db, owner_id, contact.owner_id, req);
  if (ownerResolution.error) {
    return res.status(400).json({ error: ownerResolution.error });
  }

  db.prepare(`UPDATE contacts SET first_name = ?, last_name = ?, email = ?, phone = ?, job_title = ?, company_id = ?, owner_id = ?, partner_id = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(
      first_name || contact.first_name, last_name || contact.last_name,
      email !== undefined ? email : contact.email, phone !== undefined ? phone : contact.phone,
      job_title !== undefined ? job_title : contact.job_title,
      company_id !== undefined ? company_id : contact.company_id,
      ownerResolution.ownerId,
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
  const contact = getScopedContact(db, req, req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.json({ message: 'Contact deleted' });
}

module.exports = { getAll, getById, create, update, remove };
