const bcrypt = require('bcryptjs');
const { getDb } = require('../db/connection');
const { ensureClientDefaults, ensureUniqueSlug, slugifyClientName } = require('../services/clientDefaults');

function getAll(req, res) {
  const db = getDb();
  const clients = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM users u WHERE u.client_id = c.id) AS user_count,
      (SELECT COUNT(*) FROM companies co WHERE co.client_id = c.id) AS company_count,
      (SELECT COUNT(*) FROM contacts ct WHERE ct.client_id = c.id) AS contact_count,
      (SELECT COUNT(*) FROM deals d WHERE d.client_id = c.id) AS deal_count
    FROM clients c
    ORDER BY c.name
  `).all();
  res.json(clients);
}

function create(req, res) {
  const { name, slug, is_active, admin_name, admin_email, admin_password, admin_role = 'admin' } = req.body;
  if (!name || !admin_name || !admin_email || !admin_password) {
    return res.status(400).json({ error: 'name, admin_name, admin_email, and admin_password are required' });
  }

  const db = getDb();
  const resolvedSlug = ensureUniqueSlug(db, slugifyClientName(slug || name));
  const passwordHash = bcrypt.hashSync(admin_password, 10);

  const createClientTx = db.transaction(() => {
    const clientResult = db.prepare('INSERT INTO clients (name, slug, is_active) VALUES (?, ?, ?)').run(
      name,
      resolvedSlug,
      is_active === undefined ? 1 : (is_active ? 1 : 0)
    );

    ensureClientDefaults(db, clientResult.lastInsertRowid);

    const userResult = db.prepare(
      'INSERT INTO users (name, email, password_hash, role, client_id) VALUES (?, ?, ?, ?, ?)'
    ).run(admin_name, admin_email, passwordHash, admin_role, clientResult.lastInsertRowid);

    return {
      clientId: clientResult.lastInsertRowid,
      userId: userResult.lastInsertRowid,
    };
  });

  try {
    const result = createClientTx();
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.clientId);
    const primaryUser = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.client_id
      FROM users u
      WHERE u.id = ?
    `).get(result.userId);
    res.status(201).json({ client, primary_user: primaryUser });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Client slug or user email already exists' });
    }
    throw err;
  }
}

function update(req, res) {
  const { name, slug, is_active } = req.body;
  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const nextSlug = slug !== undefined
    ? ensureUniqueSlug(db, slugifyClientName(slug), client.id)
    : client.slug;

  db.prepare(`
    UPDATE clients
    SET name = ?, slug = ?, is_active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name || client.name,
    nextSlug,
    is_active !== undefined ? (is_active ? 1 : 0) : client.is_active,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  res.json(updated);
}

module.exports = { getAll, create, update };
