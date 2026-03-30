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
  addColumn('deals', 'sentiment', "TEXT NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'negative', 'neutral'))");
  addColumn('deals', 'sentiment_updated_at', 'TEXT');
  addColumn('deals', 'lifecycle_state', "TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle_state IN ('active', 'closed'))");
  addColumn('deals', 'closed_at', 'TEXT');
  addColumn('deals', 'lifecycle_manual', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('contacts', 'partner_id', 'INTEGER REFERENCES partners(id)');
  addColumn('deal_stages', 'win_probability', 'REAL');
  addColumn('emails', 'ai_error', 'TEXT');

  // Seed default win_probability values
  const stagesToSeed = db.prepare('SELECT id, name, is_closed FROM deal_stages WHERE win_probability IS NULL').all();
  const probDefaults = { 'Lead': 10, 'Qualified': 25, 'Proposal': 50, 'Negotiation': 75, 'Won': 100, 'Lost': 0 };
  for (const stage of stagesToSeed) {
    const prob = probDefaults[stage.name] !== undefined ? probDefaults[stage.name] : (stage.is_closed ? 0 : 50);
    db.prepare('UPDATE deal_stages SET win_probability = ? WHERE id = ?').run(prob, stage.id);
  }

  // Targets table for quota tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      period TEXT NOT NULL,
      target_value REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, period)
    )
  `);

  // Backfill stage_changed_at for deals that don't have it set
  db.exec(`
    UPDATE deals SET stage_changed_at = COALESCE(
      (SELECT a.created_at FROM activities a WHERE a.deal_id = deals.id AND a.subject IN ('Stage changed', 'Stage changed by AI') ORDER BY a.created_at DESC LIMIT 1),
      deals.created_at
    ) WHERE stage_changed_at IS NULL
  `);
}

module.exports = { runMigrations };
