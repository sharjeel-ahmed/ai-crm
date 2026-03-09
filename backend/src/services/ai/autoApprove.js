const { getDb } = require('../../db/connection');
const { applySuggestion } = require('../../controllers/suggestionsController');

function checkAutoApprove(suggestionId) {
  const db = getDb();
  const suggestion = db.prepare('SELECT * FROM ai_suggestions WHERE id = ?').get(suggestionId);
  if (!suggestion || suggestion.status !== 'pending') return false;

  const rule = db.prepare('SELECT * FROM auto_approve_rules WHERE suggestion_type = ? AND is_enabled = 1').get(suggestion.type);
  if (!rule) return false;

  if (suggestion.confidence >= rule.confidence_threshold) {
    const data = JSON.parse(suggestion.data);
    // Get email date so activities reflect when the email was sent
    const email = suggestion.email_id ? db.prepare('SELECT date FROM emails WHERE id = ?').get(suggestion.email_id) : null;
    // Use user_id 1 (admin) as the system user for auto-approved actions
    const entityResult = applySuggestion(db, suggestion.type, data, 1, email?.date);

    db.prepare(
      "UPDATE ai_suggestions SET status = 'auto_approved', created_entity_type = ?, created_entity_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(entityResult.type, entityResult.id, suggestionId);

    return true;
  }

  return false;
}

module.exports = { checkAutoApprove };
