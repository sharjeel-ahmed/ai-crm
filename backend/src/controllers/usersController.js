const bcrypt = require('bcryptjs');
const { getDb } = require('../db/connection');

function getAll(req, res) {
  const db = getDb();
  const users = db.prepare('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY name').all();
  res.json(users);
}

function getById(req, res) {
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}

function create(req, res) {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password required' });
  }
  const db = getDb();
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name, email, hash, role || 'sales_rep');
    const user = db.prepare('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(user);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    throw err;
  }
}

function update(req, res) {
  const { name, email, role, is_active, password } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updates = {
    name: name || user.name,
    email: email || user.email,
    role: role || user.role,
    is_active: is_active !== undefined ? is_active : user.is_active,
    password_hash: password ? bcrypt.hashSync(password, 10) : user.password_hash,
  };

  try {
    db.prepare('UPDATE users SET name = ?, email = ?, role = ?, is_active = ?, password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(updates.name, updates.email, updates.role, updates.is_active, updates.password_hash, req.params.id);
    const updated = db.prepare('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?').get(req.params.id);
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
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'User deleted' });
}

module.exports = { getAll, getById, create, update, remove };
