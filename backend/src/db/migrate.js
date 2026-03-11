const fs = require('fs');
const path = require('path');
const { getDb } = require('./connection');

function runMigrations() {
  const db = getDb();
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
    console.log(`Migration applied: ${file}`);
  }

  // Idempotent column additions (ALTER TABLE doesn't support IF NOT EXISTS in SQLite)
  const addColumn = (table, column, type) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`); } catch (e) { /* already exists */ }
  };
  addColumn('deals', 'stage_changed_at', 'TEXT');
  addColumn('deals', 'partner_id', 'INTEGER REFERENCES partners(id)');
  addColumn('contacts', 'partner_id', 'INTEGER REFERENCES partners(id)');

  // Backfill stage_changed_at for deals that don't have it set
  db.exec(`
    UPDATE deals SET stage_changed_at = COALESCE(
      (SELECT a.created_at FROM activities a WHERE a.deal_id = deals.id AND a.subject IN ('Stage changed', 'Stage changed by AI') ORDER BY a.created_at DESC LIMIT 1),
      deals.created_at
    ) WHERE stage_changed_at IS NULL
  `);
}

module.exports = { runMigrations };
