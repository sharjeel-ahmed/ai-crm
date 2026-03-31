const { getDb } = require('../db/connection');

function getAll(req, res) {
  const db = getDb();
  const companies = db.prepare(`
    SELECT c.*, u.name as created_by_name
    FROM companies c
    LEFT JOIN users u ON c.created_by = u.id
    ORDER BY c.name
  `).all();
  res.json(companies);
}

function getById(req, res) {
  const db = getDb();
  const company = db.prepare(`
    SELECT c.*, u.name as created_by_name
    FROM companies c
    LEFT JOIN users u ON c.created_by = u.id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const contacts = db.prepare(`
    SELECT ct.*, u.name as owner_name
    FROM contacts ct
    LEFT JOIN users u ON ct.owner_id = u.id
    WHERE ct.company_id = ?
    ORDER BY ct.last_name, ct.first_name
  `).all(req.params.id);

  const deals = db.prepare(`
    SELECT d.*, ds.name as stage_name, u.name as owner_name,
      ct.first_name || ' ' || ct.last_name as contact_name
    FROM deals d
    LEFT JOIN deal_stages ds ON d.stage_id = ds.id
    LEFT JOIN users u ON d.owner_id = u.id
    LEFT JOIN contacts ct ON d.contact_id = ct.id
    WHERE d.company_id = ?
    ORDER BY d.created_at DESC
  `).all(req.params.id);

  res.json({ ...company, contacts, deals });
}

function create(req, res) {
  const { name, industry, website, phone, address, country, is_fortune_500 } = req.body;
  if (!name) return res.status(400).json({ error: 'Company name required' });

  const db = getDb();
  const result = db.prepare('INSERT INTO companies (name, industry, website, phone, address, country, is_fortune_500, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(name, industry || null, website || null, phone || null, address || null, country || null, is_fortune_500 ? 1 : 0, req.user.id);
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(company);
}

function update(req, res) {
  const { name, industry, website, phone, address, country, is_fortune_500 } = req.body;
  const db = getDb();
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) return res.status(404).json({ error: 'Company not found' });

  db.prepare(`UPDATE companies SET name = ?, industry = ?, website = ?, phone = ?, address = ?, country = ?, is_fortune_500 = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(name || company.name, industry !== undefined ? industry : company.industry, website !== undefined ? website : company.website,
      phone !== undefined ? phone : company.phone, address !== undefined ? address : company.address,
      country !== undefined ? country : company.country, is_fortune_500 !== undefined ? (is_fortune_500 ? 1 : 0) : company.is_fortune_500,
      req.params.id);
  const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  res.json(updated);
}

function remove(req, res) {
  const db = getDb();
  const result = db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Company not found' });
  res.json({ message: 'Company deleted' });
}

module.exports = { getAll, getById, create, update, remove };
