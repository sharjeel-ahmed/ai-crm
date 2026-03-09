const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { getDb } = require('../db/connection');
const { runMigrations } = require('../db/migrate');

function seed() {
  runMigrations();
  const db = getDb();

  // Seed deal stages
  const existingStages = db.prepare('SELECT COUNT(*) as count FROM deal_stages').get();
  if (existingStages.count === 0) {
    const insertStage = db.prepare('INSERT INTO deal_stages (name, display_order, is_closed) VALUES (?, ?, ?)');
    const stages = [
      ['Lead', 1, 0],
      ['Qualified', 2, 0],
      ['Proposal', 3, 0],
      ['Negotiation', 4, 0],
      ['Won', 5, 1],
      ['Lost', 6, 1],
    ];
    for (const [name, order, closed] of stages) {
      insertStage.run(name, order, closed);
    }
    console.log('Deal stages seeded');
  }

  // Seed admin user
  const existingAdmin = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
  if (existingAdmin.count === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
      'Admin User', 'admin@pazo.com', hash, 'admin'
    );
    console.log('Admin user seeded (admin@pazo.com / admin123)');
  }
}

seed();
console.log('Seed complete');
