const bcrypt = require('bcryptjs');
const { getDb } = require('../db/connection');
const { generateToken } = require('../utils/jwt');

function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const db = getDb();
  const user = db.prepare(`
    SELECT u.*, c.name AS client_name, c.slug AS client_slug
    FROM users u
    LEFT JOIN clients c ON c.id = u.client_id
    WHERE u.email = ? AND u.is_active = 1
  `).get(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user);
  const { password_hash, ...userData } = user;
  res.json({ token, user: userData });
}

function getMe(req, res) {
  const db = getDb();
  const user = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.client_id, c.name AS client_name, c.slug AS client_slug
    FROM users u
    LEFT JOIN clients c ON c.id = u.client_id
    WHERE u.id = ?
  `).get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
}

function updateMe(req, res) {
  const { name, email, current_password, new_password } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const nextName = (name || '').trim() || user.name;
  const nextEmail = (email || '').trim() || user.email;

  if (!nextName) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!nextEmail) {
    return res.status(400).json({ error: 'Email is required' });
  }

  let passwordHash = user.password_hash;
  if (new_password) {
    if (!current_password) {
      return res.status(400).json({ error: 'Current password is required to set a new password' });
    }
    const valid = bcrypt.compareSync(current_password, user.password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    passwordHash = bcrypt.hashSync(new_password, 10);
  }

  try {
    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextName, nextEmail, passwordHash, req.user.id);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    throw err;
  }

  const updated = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.client_id, c.name AS client_name, c.slug AS client_slug
    FROM users u
    LEFT JOIN clients c ON c.id = u.client_id
    WHERE u.id = ?
  `).get(req.user.id);
  res.json(updated);
}

module.exports = { login, getMe, updateMe };
