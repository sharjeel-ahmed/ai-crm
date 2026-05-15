require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { runMigrations } = require('./db/migrate');
const { addColumns } = require('./db/addColumns');
const { errorHandler } = require('./middleware/errorHandler');
const { ensureDefaultClient, ensureClientDefaults } = require('./services/clientDefaults');

// Run migrations on startup
runMigrations();

// Add new columns to existing tables (idempotent)
addColumns();

// Seed default data
const bcrypt = require('bcryptjs');
const { getDb } = require('./db/connection');
const db = getDb();

const defaultClient = ensureDefaultClient(db);
ensureClientDefaults(db, defaultClient.id);

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
const { authenticate } = require('./middleware/auth');
const { blockGlobalAdmin } = require('./middleware/blockGlobalAdmin');
const tenantGuard = [authenticate, blockGlobalAdmin];

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/companies', tenantGuard, require('./routes/companies'));
app.use('/api/contacts', tenantGuard, require('./routes/contacts'));
app.use('/api/deals', tenantGuard, require('./routes/deals'));
app.use('/api/activities', tenantGuard, require('./routes/activities'));
app.use('/api/reports', tenantGuard, require('./routes/reports'));
app.use('/api/stages', tenantGuard, require('./routes/stages'));
app.use('/api/email-accounts', tenantGuard, require('./routes/emailAccounts'));
app.use('/api/ai-settings', tenantGuard, require('./routes/aiSettings'));
app.use('/api/suggestions', tenantGuard, require('./routes/suggestions'));
app.use('/api/auto-approve', tenantGuard, require('./routes/autoApprove'));
app.use('/api/ai-logs', tenantGuard, require('./routes/aiLogs'));
app.use('/api/ignore-list', tenantGuard, require('./routes/ignoreList'));
app.use('/api/partners', tenantGuard, require('./routes/partners'));
app.use('/api/api-keys', tenantGuard, require('./routes/apiKeys'));
app.use('/api/v1', require('./routes/v1'));
app.use('/api/push', require('./routes/push'));
app.use('/api/db-viewer', require('./routes/dbViewer'));

// Serve API docs and Postman collection
const path = require('path');
const docsDir = path.join(__dirname, '../postman');
app.get('/api/docs', (req, res) => {
  res.sendFile(path.join(docsDir, 'api-docs.html'));
});
app.get('/api/docs/postman', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="pazo-crm-api.json"');
  res.sendFile(path.join(docsDir, 'pazo-crm-api.json'));
});

// Serve frontend in production
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

app.use(errorHandler);

// SPA fallback — serve index.html for non-API routes
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.sendFile(path.join(frontendDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Pazo CRM API running on port ${PORT}`);

  // Start background email worker
  const { startWorker } = require('./services/gmail/worker');
  startWorker();

  // Start push notification worker
  const { startWorker: startPushWorker } = require('./services/pushWorker');
  startPushWorker();
});
