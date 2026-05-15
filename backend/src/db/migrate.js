const fs = require('fs');
const path = require('path');
const { getDb } = require('./connection');
const { ensureDefaultClient } = require('../services/clientDefaults');

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
  addColumn('activities', 'push_notified_at', 'TEXT');
  addColumn('companies', 'country', 'TEXT');
  addColumn('companies', 'is_fortune_500', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('deals', 'priority', "TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high'))");

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  addColumn('users', 'client_id', 'INTEGER REFERENCES clients(id)');
  addColumn('companies', 'client_id', 'INTEGER REFERENCES clients(id)');
  addColumn('contacts', 'client_id', 'INTEGER REFERENCES clients(id)');
  addColumn('deals', 'client_id', 'INTEGER REFERENCES clients(id)');
  addColumn('activities', 'client_id', 'INTEGER REFERENCES clients(id)');
  addColumn('partners', 'client_id', 'INTEGER REFERENCES clients(id)');
  addColumn('email_accounts', 'client_id', 'INTEGER REFERENCES clients(id)');
  addColumn('emails', 'client_id', 'INTEGER REFERENCES clients(id)');
  addColumn('ai_settings', 'client_id', 'INTEGER REFERENCES clients(id)');
  addColumn('ai_suggestions', 'client_id', 'INTEGER REFERENCES clients(id)');
  addColumn('auto_approve_rules', 'client_id', 'INTEGER REFERENCES clients(id)');
  addColumn('email_ignore_list', 'client_id', 'INTEGER REFERENCES clients(id)');
  addColumn('deal_stages', 'client_id', 'INTEGER REFERENCES clients(id)');

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

  const defaultClient = ensureDefaultClient(db);

  // Backfill users and tenant-owned data into the default client.
  db.prepare("UPDATE users SET client_id = ? WHERE client_id IS NULL AND role != 'admin'").run(defaultClient.id);
  db.prepare('UPDATE companies SET client_id = ? WHERE client_id IS NULL').run(defaultClient.id);
  db.prepare('UPDATE contacts SET client_id = COALESCE(client_id, (SELECT client_id FROM companies WHERE companies.id = contacts.company_id), (SELECT client_id FROM users WHERE users.id = contacts.owner_id), ?) WHERE client_id IS NULL').run(defaultClient.id);
  db.prepare('UPDATE deals SET client_id = COALESCE(client_id, (SELECT client_id FROM companies WHERE companies.id = deals.company_id), (SELECT client_id FROM contacts WHERE contacts.id = deals.contact_id), (SELECT client_id FROM users WHERE users.id = deals.owner_id), ?) WHERE client_id IS NULL').run(defaultClient.id);
  db.prepare('UPDATE activities SET client_id = COALESCE(client_id, (SELECT client_id FROM deals WHERE deals.id = activities.deal_id), (SELECT client_id FROM contacts WHERE contacts.id = activities.contact_id), (SELECT client_id FROM users WHERE users.id = activities.user_id), ?) WHERE client_id IS NULL').run(defaultClient.id);
  db.prepare('UPDATE partners SET client_id = COALESCE(client_id, (SELECT client_id FROM users WHERE users.id = partners.created_by), ?) WHERE client_id IS NULL').run(defaultClient.id);
  db.prepare('UPDATE email_accounts SET client_id = COALESCE(client_id, (SELECT client_id FROM users WHERE users.id = email_accounts.user_id), ?) WHERE client_id IS NULL').run(defaultClient.id);
  db.prepare('UPDATE emails SET client_id = COALESCE(client_id, (SELECT client_id FROM email_accounts WHERE email_accounts.id = emails.email_account_id), ?) WHERE client_id IS NULL').run(defaultClient.id);
  db.prepare('UPDATE ai_settings SET client_id = ? WHERE client_id IS NULL').run(defaultClient.id);
  db.prepare('UPDATE ai_suggestions SET client_id = COALESCE(client_id, (SELECT client_id FROM emails WHERE emails.id = ai_suggestions.email_id), ?) WHERE client_id IS NULL').run(defaultClient.id);
  db.prepare('UPDATE auto_approve_rules SET client_id = ? WHERE client_id IS NULL').run(defaultClient.id);
  db.prepare('UPDATE email_ignore_list SET client_id = ? WHERE client_id IS NULL').run(defaultClient.id);
  db.prepare('UPDATE deal_stages SET client_id = ? WHERE client_id IS NULL').run(defaultClient.id);

  // Backfill stage_changed_at for deals that don't have it set
  db.exec(`
    UPDATE deals SET stage_changed_at = COALESCE(
      (SELECT a.created_at FROM activities a WHERE a.deal_id = deals.id AND a.subject IN ('Stage changed', 'Stage changed by AI') ORDER BY a.created_at DESC LIMIT 1),
      deals.created_at
    ) WHERE stage_changed_at IS NULL
  `);

  // Rebuild tables with tenant-aware uniqueness when needed.
  const indexExists = (name) => db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?").get(name);
  if (!indexExists('idx_deal_stages_client_name')) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`
      CREATE TABLE IF NOT EXISTS deal_stages_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL REFERENCES clients(id),
        name TEXT NOT NULL,
        display_order INTEGER NOT NULL,
        is_closed INTEGER NOT NULL DEFAULT 0,
        win_probability REAL
      );
      INSERT INTO deal_stages_new (id, client_id, name, display_order, is_closed, win_probability)
      SELECT id, COALESCE(client_id, ${defaultClient.id}), name, display_order, is_closed, win_probability FROM deal_stages;
      DROP TABLE deal_stages;
      ALTER TABLE deal_stages_new RENAME TO deal_stages;
      CREATE UNIQUE INDEX idx_deal_stages_client_name ON deal_stages(client_id, name);
    `);
    db.exec('PRAGMA foreign_keys = ON');
  }

  if (!indexExists('idx_auto_approve_rules_client_type')) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`
      CREATE TABLE IF NOT EXISTS auto_approve_rules_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL REFERENCES clients(id),
        suggestion_type TEXT NOT NULL,
        confidence_threshold REAL NOT NULL DEFAULT 0.95,
        is_enabled INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO auto_approve_rules_new (id, client_id, suggestion_type, confidence_threshold, is_enabled, created_at, updated_at)
      SELECT id, COALESCE(client_id, ${defaultClient.id}), suggestion_type, confidence_threshold, is_enabled, created_at, updated_at
      FROM auto_approve_rules;
      DROP TABLE auto_approve_rules;
      ALTER TABLE auto_approve_rules_new RENAME TO auto_approve_rules;
      CREATE UNIQUE INDEX idx_auto_approve_rules_client_type ON auto_approve_rules(client_id, suggestion_type);
    `);
    db.exec('PRAGMA foreign_keys = ON');
  }

  if (!indexExists('idx_email_ignore_list_client_email')) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`
      CREATE TABLE IF NOT EXISTS email_ignore_list_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL REFERENCES clients(id),
        email_address TEXT NOT NULL,
        reason TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO email_ignore_list_new (id, client_id, email_address, reason, created_at)
      SELECT id, COALESCE(client_id, ${defaultClient.id}), email_address, reason, created_at
      FROM email_ignore_list;
      DROP TABLE email_ignore_list;
      ALTER TABLE email_ignore_list_new RENAME TO email_ignore_list;
      CREATE UNIQUE INDEX idx_email_ignore_list_client_email ON email_ignore_list(client_id, email_address);
    `);
    db.exec('PRAGMA foreign_keys = ON');
  }
}

module.exports = { runMigrations };
