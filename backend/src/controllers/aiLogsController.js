const { getDb } = require('../db/connection');

function getLogs(req, res) {
  const db = getDb();
  const { limit = 50, offset = 0 } = req.query;

  const allEmails = db.prepare(`
    SELECT e.id, e.subject, e.from_address, e.from_name, e.to_addresses, e.date, e.is_inbound, e.ai_processed,
           e.ai_prompt, e.ai_response,
           e.created_at as synced_at, ea.email_address as account_email
    FROM emails e
    JOIN email_accounts ea ON e.email_account_id = ea.id
  `).all();

  const total = allEmails.length;

  // Sort by parsed date descending (Gmail date headers can't be sorted as text in SQLite)
  allEmails.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db2 = b.date ? new Date(b.date).getTime() : 0;
    return db2 - da;
  });

  const emails = allEmails.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

  // Get suggestions for each email
  const stmtSuggestions = db.prepare(
    'SELECT id, type, confidence, reasoning, status, created_at FROM ai_suggestions WHERE email_id = ? ORDER BY id'
  );

  const logs = emails.map(email => {
    const suggestions = stmtSuggestions.all(email.id);
    let action;
    if (!email.ai_processed) {
      action = 'pending';
    } else if (suggestions.length === 0) {
      action = 'no_action';
    } else {
      action = 'suggestions_created';
    }

    return {
      ...email,
      action,
      suggestions,
    };
  });

  res.json({ logs, total });
}

function deleteLog(req, res) {
  const db = getDb();
  const { id } = req.params;

  const email = db.prepare('SELECT id, email_account_id, date FROM emails WHERE id = ?').get(parseInt(id));
  if (!email) return res.status(404).json({ error: 'Email log not found' });

  // Delete suggestions linked to this email, then the email itself
  db.prepare('DELETE FROM ai_suggestions WHERE email_id = ?').run(email.id);
  db.prepare('DELETE FROM emails WHERE id = ?').run(email.id);

  // Reset last_sync_at to before this email's date so next sync re-fetches it
  if (email.date) {
    const emailDate = new Date(email.date);
    emailDate.setDate(emailDate.getDate() - 1);
    const resetDate = emailDate.toISOString().replace('T', ' ').substring(0, 19);
    const account = db.prepare('SELECT last_sync_at FROM email_accounts WHERE id = ?').get(email.email_account_id);
    if (!account.last_sync_at || new Date(account.last_sync_at) > emailDate) {
      db.prepare("UPDATE email_accounts SET last_sync_at = ?, updated_at = datetime('now') WHERE id = ?")
        .run(resetDate, email.email_account_id);
    }
  }

  res.json({ success: true });
}

function deleteFromHere(req, res) {
  const db = getDb();
  const { id } = req.params;

  const email = db.prepare('SELECT id, email_account_id, date FROM emails WHERE id = ?').get(parseInt(id));
  if (!email) return res.status(404).json({ error: 'Email log not found' });

  // Delete this email and all newer emails (by date) for the same account
  const toDelete = db.prepare(
    'SELECT id FROM emails WHERE email_account_id = ? AND date >= ?'
  ).all(email.email_account_id, email.date);

  const ids = toDelete.map(e => e.id);
  if (ids.length > 0) {
    db.prepare(`DELETE FROM ai_suggestions WHERE email_id IN (${ids.join(',')})`).run();
    db.prepare(`DELETE FROM emails WHERE id IN (${ids.join(',')})`).run();
  }

  // Reset last_sync_at to before this email's date so next sync re-fetches from this point
  if (email.date) {
    const emailDate = new Date(email.date);
    emailDate.setDate(emailDate.getDate() - 1);
    const resetDate = emailDate.toISOString().replace('T', ' ').substring(0, 19);
    db.prepare("UPDATE email_accounts SET last_sync_at = ?, updated_at = datetime('now') WHERE id = ?")
      .run(resetDate, email.email_account_id);
  } else {
    db.prepare("UPDATE email_accounts SET last_sync_at = NULL, updated_at = datetime('now') WHERE id = ?")
      .run(email.email_account_id);
  }

  res.json({ success: true, deleted: ids.length });
}

module.exports = { getLogs, deleteLog, deleteFromHere };
