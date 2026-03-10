const { getDb } = require('../db/connection');

function getFrontendBaseUrl(req) {
  const configured = process.env.FRONTEND_BASE_URL;
  if (configured) return configured.replace(/\/+$/, '');

  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${protocol}://${host}`;
}

function getAuthUrl(req, res) {
  try {
    const { getAuthUrl } = require('../services/gmail/oauth');
    const url = getAuthUrl(req.user.id);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleCallback(req, res) {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('Missing authorization code');

  try {
    const { exchangeCode, getGmailProfile } = require('../services/gmail/oauth');
    const userId = state ? parseInt(state) : null;
    if (!userId) return res.status(400).send('Invalid state parameter');

    const tokens = await exchangeCode(code);
    const profile = await getGmailProfile(tokens.access_token);

    const db = getDb();
    const existing = db.prepare('SELECT * FROM email_accounts WHERE email_address = ? AND user_id = ?').get(profile.email, userId);

    if (existing) {
      db.prepare(
        "UPDATE email_accounts SET access_token = ?, refresh_token = ?, token_expires_at = ?, sync_enabled = 1, updated_at = datetime('now') WHERE id = ?"
      ).run(tokens.access_token, tokens.refresh_token || existing.refresh_token, tokens.expiry_date || null, existing.id);
    } else {
      db.prepare(
        'INSERT INTO email_accounts (user_id, provider, email_address, access_token, refresh_token, token_expires_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(userId, 'gmail', profile.email, tokens.access_token, tokens.refresh_token || '', tokens.expiry_date || null);
    }

    const frontendBaseUrl = getFrontendBaseUrl(req);
    res.redirect(`${frontendBaseUrl}/settings?tab=email&connected=true`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    const frontendBaseUrl = getFrontendBaseUrl(req);
    res.redirect(`${frontendBaseUrl}/settings?tab=email&error=${encodeURIComponent(err.message)}`);
  }
}

function getAll(req, res) {
  const db = getDb();
  const accounts = db.prepare(
    'SELECT id, user_id, provider, email_address, last_sync_at, sync_enabled, created_at FROM email_accounts WHERE user_id = ?'
  ).all(req.user.id);
  res.json(accounts);
}

function remove(req, res) {
  const db = getDb();
  const { id } = req.params;
  const account = db.prepare('SELECT * FROM email_accounts WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  db.prepare('DELETE FROM email_accounts WHERE id = ?').run(id);
  res.json({ success: true });
}

async function runPipelineInBackground() {
  try {
    const { processUnprocessedEmails } = require('../services/ai/pipeline');
    await processUnprocessedEmails();
  } catch (err) {
    console.error('AI pipeline error:', err.message);
  }
}

async function syncNow(req, res) {
  const db = getDb();
  const { id } = req.params;
  const account = db.prepare('SELECT * FROM email_accounts WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  try {
    const { syncEmails } = require('../services/gmail/sync');
    const count = await syncEmails(account);
    res.json({ success: true, synced: count });
    // Run AI pipeline after responding
    runPipelineInBackground();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function resync(req, res) {
  const db = getDb();
  const { id } = req.params;
  const account = db.prepare('SELECT * FROM email_accounts WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  try {
    // Reset last_sync_at so it fetches last 3 days fresh
    db.prepare("UPDATE email_accounts SET last_sync_at = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
    // Delete existing emails and their suggestions for clean re-import
    db.prepare('DELETE FROM ai_suggestions WHERE email_id IN (SELECT id FROM emails WHERE email_account_id = ?)').run(id);
    db.prepare('DELETE FROM emails WHERE email_account_id = ?').run(id);

    const { syncEmails } = require('../services/gmail/sync');
    const refreshedAccount = db.prepare('SELECT * FROM email_accounts WHERE id = ?').get(id);
    const count = await syncEmails(refreshedAccount);
    res.json({ success: true, synced: count });
    // Run AI pipeline after responding
    runPipelineInBackground();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getAuthUrl, handleCallback, getAll, remove, syncNow, resync };
