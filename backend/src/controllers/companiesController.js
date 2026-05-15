const { getDb } = require('../db/connection');
const { getClientFilter, getEffectiveClientId } = require('../utils/tenant');

function getCompanyAccess(db, req, companyId) {
  const company = db.prepare(`
    SELECT c.*, u.name as created_by_name
    FROM companies c
    LEFT JOIN users u ON c.created_by = u.id
    WHERE c.id = ?${getClientFilter(req, 'c').clause}
  `).get(companyId, ...getClientFilter(req, 'c').params);

  if (!company) return null;
  if (req.user.role !== 'sales_rep') return company;

  const hasOwnedRecords = db.prepare(`
    SELECT 1
    FROM companies c
    LEFT JOIN contacts ct ON ct.company_id = c.id AND ct.owner_id = ?
    LEFT JOIN deals d ON d.company_id = c.id AND d.owner_id = ?
    WHERE c.id = ?
      AND (ct.id IS NOT NULL OR d.id IS NOT NULL)
    LIMIT 1
  `).get(req.user.id, req.user.id, companyId);

  return hasOwnedRecords ? company : null;
}

function getAll(req, res) {
  const db = getDb();
  const clientFilter = getClientFilter(req, 'c');
  const companies = db.prepare(`
    SELECT c.*, u.name as created_by_name
    FROM companies c
    LEFT JOIN users u ON c.created_by = u.id
    WHERE 1=1 ${clientFilter.clause}
    ORDER BY c.name
  `).all(...clientFilter.params);
  res.json(companies);
}

function getById(req, res) {
  const db = getDb();
  const company = getCompanyAccess(db, req, req.params.id);
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const contactWhere = req.user.role === 'sales_rep' ? 'AND ct.owner_id = ?' : '';
  const contactParams = req.user.role === 'sales_rep' ? [req.params.id, req.user.id] : [req.params.id];
  const contacts = db.prepare(`
    SELECT ct.*, u.name as owner_name
    FROM contacts ct
    LEFT JOIN users u ON ct.owner_id = u.id
    WHERE ct.company_id = ?
    ${contactWhere}
    ORDER BY ct.last_name, ct.first_name
  `).all(...contactParams);

  const dealWhere = req.user.role === 'sales_rep' ? 'AND d.owner_id = ?' : '';
  const dealParams = req.user.role === 'sales_rep' ? [req.params.id, req.user.id] : [req.params.id];
  const deals = db.prepare(`
    SELECT d.*, ds.name as stage_name, u.name as owner_name,
      ct.first_name || ' ' || ct.last_name as contact_name
    FROM deals d
    LEFT JOIN deal_stages ds ON d.stage_id = ds.id
    LEFT JOIN users u ON d.owner_id = u.id
    LEFT JOIN contacts ct ON d.contact_id = ct.id
    WHERE d.company_id = ?
    ${dealWhere}
    ORDER BY d.created_at DESC
  `).all(...dealParams);

  res.json({ ...company, contacts, deals });
}

function create(req, res) {
  const { name, industry, website, phone, address, country, is_fortune_500 } = req.body;
  if (!name) return res.status(400).json({ error: 'Company name required' });

  const db = getDb();
  const result = db.prepare('INSERT INTO companies (name, industry, website, phone, address, country, is_fortune_500, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(name, industry || null, website || null, phone || null, address || null, country || null, is_fortune_500 ? 1 : 0, req.user.id);
  db.prepare('UPDATE companies SET client_id = ? WHERE id = ?').run(getEffectiveClientId(req, db), result.lastInsertRowid);
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(company);
}

function update(req, res) {
  const { name, industry, website, phone, address, country, is_fortune_500 } = req.body;
  const db = getDb();
  const filter = getClientFilter(req);
  const company = db.prepare(`SELECT * FROM companies WHERE id = ?${filter.clause}`).get(req.params.id, ...filter.params);
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
  const filter = getClientFilter(req);
  const result = db.prepare(`DELETE FROM companies WHERE id = ?${filter.clause}`).run(req.params.id, ...filter.params);
  if (result.changes === 0) return res.status(404).json({ error: 'Company not found' });
  res.json({ message: 'Company deleted' });
}

module.exports = { getAll, getById, create, update, remove };
