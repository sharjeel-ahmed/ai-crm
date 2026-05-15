const bcrypt = require('bcryptjs');
const { getDb } = require('../db/connection');
const { ensureClientDefaults, ensureUniqueSlug, slugifyClientName } = require('../services/clientDefaults');
const { isGlobalAdmin } = require('../utils/tenant');

function getAll(req, res) {
  const db = getDb();
  let users;
  if (isGlobalAdmin(req.user)) {
    users = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.client_id, c.name AS client_name, c.slug AS client_slug
      FROM users u
      LEFT JOIN clients c ON c.id = u.client_id
      ORDER BY c.name, u.name
    `).all();
  } else {
    users = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.client_id, c.name AS client_name, c.slug AS client_slug
      FROM users u
      LEFT JOIN clients c ON c.id = u.client_id
      WHERE u.client_id = ?
      ORDER BY u.name
    `).all(req.user.client_id);
  }
  res.json(users);
}

function getById(req, res) {
  const db = getDb();
  const user = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.client_id, c.name AS client_name, c.slug AS client_slug
    FROM users u
    LEFT JOIN clients c ON c.id = u.client_id
    WHERE u.id = ?
  `).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!isGlobalAdmin(req.user) && user.client_id !== req.user.client_id) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
}

function create(req, res) {
  const { name, email, password, role, client_id, client_name } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password required' });
  }
  const db = getDb();
  const hash = bcrypt.hashSync(password, 10);

  let targetClientId = req.user.client_id || null;
  if (isGlobalAdmin(req.user)) {
    if (client_id) {
      targetClientId = parseInt(client_id, 10);
    } else if (client_name) {
      const slug = ensureUniqueSlug(db, slugifyClientName(client_name));
      const clientResult = db.prepare('INSERT INTO clients (name, slug, is_active) VALUES (?, ?, 1)').run(client_name, slug);
      targetClientId = clientResult.lastInsertRowid;
      ensureClientDefaults(db, targetClientId);
    }
  }

  if (!targetClientId) {
    return res.status(400).json({ error: 'client_id or client_name is required' });
  }

  const client = db.prepare('SELECT id FROM clients WHERE id = ? AND is_active = 1').get(targetClientId);
  if (!client) {
    return res.status(400).json({ error: 'Client not found or inactive' });
  }

  try {
    const result = db.prepare('INSERT INTO users (name, email, password_hash, role, client_id) VALUES (?, ?, ?, ?, ?)')
      .run(name, email, hash, role || 'sales_rep', targetClientId);
    const user = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.client_id, c.name AS client_name, c.slug AS client_slug
      FROM users u
      LEFT JOIN clients c ON c.id = u.client_id
      WHERE u.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(user);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    throw err;
  }
}

function update(req, res) {
  const { name, email, role, is_active, password, client_id } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!isGlobalAdmin(req.user) && user.client_id !== req.user.client_id) {
    return res.status(404).json({ error: 'User not found' });
  }

  let nextClientId = user.client_id;
  if (isGlobalAdmin(req.user) && client_id !== undefined) {
    nextClientId = client_id ? parseInt(client_id, 10) : null;
  }
  if (!isGlobalAdmin(req.user)) {
    nextClientId = req.user.client_id;
  }

  const updates = {
    name: name || user.name,
    email: email || user.email,
    role: role || user.role,
    is_active: is_active !== undefined ? is_active : user.is_active,
    password_hash: password ? bcrypt.hashSync(password, 10) : user.password_hash,
    client_id: nextClientId,
  };

  try {
    db.prepare('UPDATE users SET name = ?, email = ?, role = ?, is_active = ?, password_hash = ?, client_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(updates.name, updates.email, updates.role, updates.is_active, updates.password_hash, updates.client_id, req.params.id);
    const updated = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.client_id, c.name AS client_name, c.slug AS client_slug
      FROM users u
      LEFT JOIN clients c ON c.id = u.client_id
      WHERE u.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    throw err;
  }
}

function remove(req, res) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!isGlobalAdmin(req.user) && user.client_id !== req.user.client_id) {
    return res.status(404).json({ error: 'User not found' });
  }
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deleted' });
}

module.exports = { getAll, getById, create, update, remove };
