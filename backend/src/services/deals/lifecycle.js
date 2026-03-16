function syncDealLifecycleStates(db) {
  db.exec(`
    UPDATE deals
    SET lifecycle_state = 'closed',
        closed_at = COALESCE(closed_at, datetime('now')),
        updated_at = datetime('now')
    WHERE stage_id IN (
      SELECT id FROM deal_stages WHERE name IN ('Won', 'Lost')
    )
      AND julianday('now') - julianday(COALESCE(stage_changed_at, updated_at, created_at)) > 60
      AND COALESCE(lifecycle_state, 'active') != 'closed'
      AND COALESCE(lifecycle_manual, 0) = 0
  `);

  db.exec(`
    UPDATE deals
    SET lifecycle_state = 'active',
        closed_at = NULL,
        updated_at = datetime('now')
    WHERE (
      stage_id NOT IN (
        SELECT id FROM deal_stages WHERE name IN ('Won', 'Lost')
      )
      OR julianday('now') - julianday(COALESCE(stage_changed_at, updated_at, created_at)) <= 60
    )
      AND COALESCE(lifecycle_state, 'active') != 'active'
      AND COALESCE(lifecycle_manual, 0) = 0
  `);
}

function includeClosed(req) {
  return req.query.include_closed === '1';
}

function activeDealClause(alias = 'd') {
  return `AND COALESCE(${alias}.lifecycle_state, 'active') != 'closed'`;
}

module.exports = { syncDealLifecycleStates, includeClosed, activeDealClause };
