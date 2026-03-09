-- Email accounts for Gmail OAuth
CREATE TABLE IF NOT EXISTS email_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL DEFAULT 'gmail',
  email_address TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at INTEGER,
  last_sync_at TEXT,
  sync_enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Synced emails
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_account_id INTEGER NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  gmail_message_id TEXT UNIQUE,
  gmail_thread_id TEXT,
  subject TEXT,
  from_address TEXT,
  from_name TEXT,
  to_addresses TEXT, -- JSON array
  body_text TEXT,
  date TEXT,
  is_inbound INTEGER DEFAULT 1,
  ai_processed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- AI provider settings
CREATE TABLE IF NOT EXISTS ai_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL, -- claude, openai, gemini, openrouter
  api_key TEXT,
  model TEXT,
  is_active INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- AI suggestions queue
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id INTEGER REFERENCES emails(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- create_contact, create_company, create_deal, move_deal_stage, log_activity, update_contact
  data TEXT NOT NULL, -- JSON
  confidence REAL NOT NULL DEFAULT 0, -- 0-1
  reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, dismissed, auto_approved
  resolved_by INTEGER REFERENCES users(id),
  created_entity_type TEXT,
  created_entity_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Auto-approve rules per suggestion type
CREATE TABLE IF NOT EXISTS auto_approve_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  suggestion_type TEXT UNIQUE NOT NULL,
  confidence_threshold REAL NOT NULL DEFAULT 0.95,
  is_enabled INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
