const { getDb } = require('../db/connection');

function getLogs(req, res) {
  const db = getDb();
  const { limit = 50, offset = 0 } = req.query;

  const emails = db.prepare(`
    SELECT e.id, e.subject, e.from_address, e.from_name, e.to_addresses, e.date, e.is_inbound, e.ai_processed,
           e.ai_prompt, e.ai_response,
           e.created_at as synced_at, ea.email_address as account_email
    FROM emails e
    JOIN email_accounts ea ON e.email_account_id = ea.id
    ORDER BY e.id DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(limit), parseInt(offset));

  const total = db.prepare('SELECT COUNT(*) as c FROM emails').get().c;

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

module.exports = { getLogs };
