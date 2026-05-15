function slugifyClientName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function ensureUniqueSlug(db, baseSlug, excludeClientId = null) {
  const seed = baseSlug || 'client';
  let slug = seed;
  let suffix = 2;

  while (true) {
    const existing = excludeClientId
      ? db.prepare('SELECT id FROM clients WHERE slug = ? AND id != ?').get(slug, excludeClientId)
      : db.prepare('SELECT id FROM clients WHERE slug = ?').get(slug);
    if (!existing) return slug;
    slug = `${seed}-${suffix++}`;
  }
}

function ensureDefaultClient(db) {
  let client = db.prepare('SELECT * FROM clients ORDER BY id LIMIT 1').get();
  if (client) return client;

  const slug = ensureUniqueSlug(db, 'default-workspace');
  const result = db.prepare('INSERT INTO clients (name, slug, is_active) VALUES (?, ?, 1)').run('Default Workspace', slug);
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
}

function ensureClientDefaults(db, clientId) {
  const stageCount = db.prepare('SELECT COUNT(*) AS count FROM deal_stages WHERE client_id = ?').get(clientId).count;
  if (stageCount === 0) {
    const insertStage = db.prepare(
      'INSERT INTO deal_stages (client_id, name, display_order, is_closed, win_probability) VALUES (?, ?, ?, ?, ?)'
    );
    [
      ['Lead', 1, 0, 10],
      ['Qualified', 2, 0, 25],
      ['Proposal', 3, 0, 50],
      ['Negotiation', 4, 0, 75],
      ['Won', 5, 1, 100],
      ['Lost', 6, 1, 0],
    ].forEach(([name, order, closed, probability]) => insertStage.run(clientId, name, order, closed, probability));
  }

  const ruleCount = db.prepare('SELECT COUNT(*) AS count FROM auto_approve_rules WHERE client_id = ?').get(clientId).count;
  if (ruleCount === 0) {
    const insertRule = db.prepare(
      'INSERT INTO auto_approve_rules (client_id, suggestion_type, confidence_threshold, is_enabled) VALUES (?, ?, ?, ?)'
    );
    ['create_contact', 'create_company', 'create_deal', 'log_activity', 'update_contact', 'move_deal_stage']
      .forEach((type) => insertRule.run(clientId, type, 0.95, 0));
  }
}

module.exports = {
  slugifyClientName,
  ensureUniqueSlug,
  ensureDefaultClient,
  ensureClientDefaults,
};
