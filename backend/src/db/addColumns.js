const { getDb } = require('./connection');

function addColumns() {
  const db = getDb();

  // Create email ignore list table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_ignore_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_address TEXT NOT NULL UNIQUE,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const alterations = [
    { table: 'contacts', column: 'ai_generated', definition: 'INTEGER DEFAULT 0' },
    { table: 'contacts', column: 'lead_source', definition: 'TEXT' },
    { table: 'companies', column: 'ai_generated', definition: 'INTEGER DEFAULT 0' },
    { table: 'deals', column: 'ai_generated', definition: 'INTEGER DEFAULT 0' },
    { table: 'deals', column: 'lead_source', definition: 'TEXT' },
    { table: 'deals', column: 'sentiment', definition: "TEXT NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'negative', 'neutral'))" },
    { table: 'deals', column: 'sentiment_updated_at', definition: 'TEXT' },
    { table: 'deals', column: 'lifecycle_state', definition: "TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle_state IN ('active', 'closed'))" },
    { table: 'deals', column: 'closed_at', definition: 'TEXT' },
    { table: 'activities', column: 'ai_generated', definition: 'INTEGER DEFAULT 0' },
    { table: 'ai_settings', column: 'custom_prompt', definition: 'TEXT' },
    { table: 'emails', column: 'ai_prompt', definition: 'TEXT' },
    { table: 'emails', column: 'ai_response', definition: 'TEXT' },
    { table: 'emails', column: 'ai_sentiment', definition: "TEXT NOT NULL DEFAULT 'neutral' CHECK (ai_sentiment IN ('positive', 'negative', 'neutral'))" },
    { table: 'emails', column: 'ai_sentiment_confidence', definition: 'REAL DEFAULT 0' },
    { table: 'emails', column: 'ai_sentiment_reasoning', definition: 'TEXT' },
    { table: 'deal_stages', column: 'win_probability', definition: 'REAL' },
  ];

  for (const { table, column, definition } of alterations) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch (err) {
      // Column already exists — ignore
    }
  }
}

module.exports = { addColumns };
