require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { runMigrations } = require('./db/migrate');
const { addColumns } = require('./db/addColumns');
const { errorHandler } = require('./middleware/errorHandler');

// Run migrations on startup
runMigrations();

// Add new columns to existing tables (idempotent)
addColumns();

// Seed default data
const bcrypt = require('bcryptjs');
const { getDb } = require('./db/connection');
const db = getDb();

const stageCount = db.prepare('SELECT COUNT(*) as count FROM deal_stages').get();
if (stageCount.count === 0) {
  const insertStage = db.prepare('INSERT INTO deal_stages (name, display_order, is_closed) VALUES (?, ?, ?)');
  [['Lead', 1, 0], ['Qualified', 2, 0], ['Proposal', 3, 0], ['Negotiation', 4, 0], ['Won', 5, 1], ['Lost', 6, 1]]
    .forEach(([name, order, closed]) => insertStage.run(name, order, closed));
  console.log('Default stages seeded');
}

const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
if (adminCount.count === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run('Admin User', 'admin@pazo.com', hash, 'admin');
  console.log('Admin user seeded (admin@pazo.com / admin123)');
}

const app = express();
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/deals', require('./routes/deals'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/stages', require('./routes/stages'));
app.use('/api/email-accounts', require('./routes/emailAccounts'));
app.use('/api/ai-settings', require('./routes/aiSettings'));
app.use('/api/suggestions', require('./routes/suggestions'));
app.use('/api/auto-approve', require('./routes/autoApprove'));
app.use('/api/ai-logs', require('./routes/aiLogs'));
app.use('/api/ignore-list', require('./routes/ignoreList'));
app.use('/api/partners', require('./routes/partners'));

// Serve frontend in production
const path = require('path');
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

app.use(errorHandler);

// SPA fallback — serve index.html for non-API routes
app.use((req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendDist, 'index.html'));
  }
});

// Seed default auto-approve rules
const ruleCount = db.prepare('SELECT COUNT(*) as count FROM auto_approve_rules').get();
if (ruleCount.count === 0) {
  const insertRule = db.prepare('INSERT INTO auto_approve_rules (suggestion_type, confidence_threshold, is_enabled) VALUES (?, ?, ?)');
  ['create_contact', 'create_company', 'create_deal', 'log_activity', 'update_contact', 'move_deal_stage']
    .forEach(type => insertRule.run(type, 0.95, 0));
  console.log('Default auto-approve rules seeded');
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Pazo CRM API running on port ${PORT}`);

  // Start background email worker
  const { startWorker } = require('./services/gmail/worker');
  startWorker();
});
