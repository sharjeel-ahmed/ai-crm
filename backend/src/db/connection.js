const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const configuredDbPath = process.env.DB_PATH || path.join(__dirname, '../../data/crm.db');
const dbPath = path.isAbsolute(configuredDbPath)
  ? configuredDbPath
  : path.resolve(process.cwd(), configuredDbPath);

let db;

function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

module.exports = { getDb };
