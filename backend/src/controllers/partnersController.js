const { getDb } = require('../db/connection');
const { getClientFilter, getEffectiveClientId } = require('../utils/tenant');

function getAll(req, res) {
  const db = getDb();
  const filter = getClientFilter(req, 'p');
  const partners = db.prepare(`
    SELECT p.*, u.name as created_by_name
    FROM partners p
    LEFT JOIN users u ON p.created_by = u.id
    WHERE 1=1 ${filter.clause}
    ORDER BY p.name
  `).all(...filter.params);
  res.json(partners);
}

function getById(req, res) {
  const db = getDb();
  const filter = getClientFilter(req, 'p');
  const partner = db.prepare(`
    SELECT p.*, u.name as created_by_name
    FROM partners p
    LEFT JOIN users u ON p.created_by = u.id
    WHERE p.id = ?${filter.clause}
  `).get(req.params.id, ...filter.params);
  if (!partner) return res.status(404).json({ error: 'Partner not found' });

  const contacts = db.prepare(`
    SELECT ct.*, c.name as company_name
    FROM contacts ct
    LEFT JOIN companies c ON ct.company_id = c.id
    WHERE ct.partner_id = ?
    ORDER BY ct.last_name, ct.first_name
  `).all(req.params.id);

  const deals = db.prepare(`
    SELECT d.*, ds.name as stage_name, c.name as company_name, u.name as owner_name
    FROM deals d
    LEFT JOIN deal_stages ds ON d.stage_id = ds.id
    LEFT JOIN companies c ON d.company_id = c.id
    LEFT JOIN users u ON d.owner_id = u.id
    WHERE d.partner_id = ?
    ORDER BY d.created_at DESC
  `).all(req.params.id);

  res.json({ ...partner, contacts, deals });
}

function create(req, res) {
  const { name, type, contact_name, email, phone, notes } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Partner name and type are required' });

  const db = getDb();
  const result = db.prepare('INSERT INTO partners (name, type, contact_name, email, phone, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(name, type, contact_name || null, email || null, phone || null, notes || null, req.user.id);
  db.prepare('UPDATE partners SET client_id = ? WHERE id = ?').run(getEffectiveClientId(req, db), result.lastInsertRowid);
  const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(partner);
}

function update(req, res) {
  const { name, type, contact_name, email, phone, notes } = req.body;
  const db = getDb();
  const filter = getClientFilter(req);
  const partner = db.prepare(`SELECT * FROM partners WHERE id = ?${filter.clause}`).get(req.params.id, ...filter.params);
  if (!partner) return res.status(404).json({ error: 'Partner not found' });

  db.prepare(`UPDATE partners SET name = ?, type = ?, contact_name = ?, email = ?, phone = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(
      name || partner.name,
      type || partner.type,
      contact_name !== undefined ? contact_name : partner.contact_name,
      email !== undefined ? email : partner.email,
      phone !== undefined ? phone : partner.phone,
      notes !== undefined ? notes : partner.notes,
      req.params.id
    );
  const updated = db.prepare('SELECT * FROM partners WHERE id = ?').get(req.params.id);
  res.json(updated);
}

function remove(req, res) {
  const db = getDb();
  const filter = getClientFilter(req);
  const result = db.prepare(`DELETE FROM partners WHERE id = ?${filter.clause}`).run(req.params.id, ...filter.params);
  if (result.changes === 0) return res.status(404).json({ error: 'Partner not found' });
  res.json({ message: 'Partner deleted' });
}

module.exports = { getAll, getById, create, update, remove };
