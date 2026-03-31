const { getDb } = require('../db/connection');
const { refreshDealSentiment } = require('../services/deals/sentiment');
const { syncDealLifecycleStates, includeClosed, activeDealClause } = require('../services/deals/lifecycle');

function parseDbDate(value) {
  if (!value) return null;
  return new Date(typeof value === 'string' ? value.replace(' ', 'T') : value);
}

function withDaysInStage(deal) {
  const stageDate = parseDbDate(deal.stage_changed_at || deal.updated_at || deal.created_at);
  const daysInStage = !stageDate || Number.isNaN(stageDate.getTime())
    ? 0
    : Math.max(0, Math.floor((Date.now() - stageDate.getTime()) / 86400000));

  return {
    ...deal,
    days_in_stage: daysInStage,
  };
}

function scopeQuery(req) {
  let where = '';
  const params = [];

  if (req.user.role === 'sales_rep') {
    where += ' AND d.owner_id = ?';
    params.push(req.user.id);
  } else if (req.query.my_deals === 'true') {
    where += ' AND d.owner_id = ?';
    params.push(req.user.id);
  } else if (req.query.owner_id) {
    where += ' AND d.owner_id = ?';
    params.push(parseInt(req.query.owner_id));
  }

  if (req.query.stage_id) {
    where += ' AND d.stage_id = ?';
    params.push(parseInt(req.query.stage_id));
  }

  if (req.query.lead_source) {
    where += ' AND d.lead_source = ?';
    params.push(req.query.lead_source);
  }

  return { where, params };
}

function getOwnerById(db, ownerId) {
  if (!ownerId) return null;
  return db.prepare('SELECT id, name, email, role FROM users WHERE id = ? AND is_active = 1').get(ownerId);
}

function resolveOwnerId(db, ownerId, fallbackOwnerId) {
  const resolvedOwnerId = ownerId !== undefined && ownerId !== null && ownerId !== '' ? parseInt(ownerId, 10) : fallbackOwnerId;
  if (!resolvedOwnerId) {
    return { error: 'Owner is required' };
  }

  if (Number.isNaN(resolvedOwnerId)) {
    return { error: 'Owner must be a valid user' };
  }

  const owner = getOwnerById(db, resolvedOwnerId);
  if (!owner) {
    return { error: 'Selected owner was not found or is inactive' };
  }

  return { ownerId: resolvedOwnerId, owner };
}

function resolvePriority(db, companyId, explicitPriority) {
  if (explicitPriority) return explicitPriority;
  if (!companyId) return 'medium';
  const company = db.prepare('SELECT country, is_fortune_500 FROM companies WHERE id = ?').get(companyId);
  if (!company) return 'medium';
  const isUS = company.country && company.country.toLowerCase().match(/^(us|usa|united states|united states of america)$/);
  if (isUS || company.is_fortune_500) return 'high';
  return 'medium';
}

function getOwners(req, res) {
  const db = getDb();
  const owners = db.prepare(`
    SELECT id, name, email, role
    FROM users
    WHERE is_active = 1
    ORDER BY name
  `).all();
  res.json(owners);
}

function getAll(req, res) {
  const db = getDb();
  syncDealLifecycleStates(db);
  const scope = scopeQuery(req);
  const lifecycleClause = includeClosed(req) ? '' : ` ${activeDealClause('d')}`;
  const deals = db.prepare(`
    SELECT d.*, ds.name as stage_name, c.name as company_name,
      ct.first_name || ' ' || ct.last_name as contact_name, u.name as owner_name,
      p.name as partner_name
    FROM deals d
    LEFT JOIN deal_stages ds ON d.stage_id = ds.id
    LEFT JOIN companies c ON d.company_id = c.id
    LEFT JOIN contacts ct ON d.contact_id = ct.id
    LEFT JOIN users u ON d.owner_id = u.id
    LEFT JOIN partners p ON d.partner_id = p.id
    WHERE 1=1 ${scope.where}${lifecycleClause}
    ORDER BY d.created_at DESC
  `).all(...scope.params).map((deal) => withDaysInStage(refreshDealSentiment(db, deal)));
  res.json(deals);
}

function getPipeline(req, res) {
  const db = getDb();
  syncDealLifecycleStates(db);
  const scope = scopeQuery(req);
  const stages = db.prepare('SELECT * FROM deal_stages ORDER BY display_order').all();
  const lifecycleClause = includeClosed(req) ? '' : ` ${activeDealClause('d')}`;
  const deals = db.prepare(`
    SELECT d.*, ds.name as stage_name, c.name as company_name,
      ct.first_name || ' ' || ct.last_name as contact_name, u.name as owner_name,
      p.name as partner_name
    FROM deals d
    LEFT JOIN deal_stages ds ON d.stage_id = ds.id
    LEFT JOIN companies c ON d.company_id = c.id
    LEFT JOIN contacts ct ON d.contact_id = ct.id
    LEFT JOIN users u ON d.owner_id = u.id
    LEFT JOIN partners p ON d.partner_id = p.id
    WHERE 1=1 ${scope.where}${lifecycleClause}
    ORDER BY d.position
  `).all(...scope.params).map((deal) => withDaysInStage(refreshDealSentiment(db, deal)));

  const pipeline = stages.map(stage => ({
    ...stage,
    deals: deals.filter(d => d.stage_id === stage.id),
  }));
  res.json(pipeline);
}

function getById(req, res) {
  const db = getDb();
  syncDealLifecycleStates(db);
  const dealRow = db.prepare(`
    SELECT d.*, ds.name as stage_name, c.name as company_name,
      ct.first_name || ' ' || ct.last_name as contact_name, u.name as owner_name,
      p.name as partner_name
    FROM deals d
    LEFT JOIN deal_stages ds ON d.stage_id = ds.id
    LEFT JOIN companies c ON d.company_id = c.id
    LEFT JOIN contacts ct ON d.contact_id = ct.id
    LEFT JOIN users u ON d.owner_id = u.id
    LEFT JOIN partners p ON d.partner_id = p.id
    WHERE d.id = ?
  `).get(req.params.id);
  if (!dealRow) return res.status(404).json({ error: 'Deal not found' });
  const deal = withDaysInStage(refreshDealSentiment(db, dealRow));

  // Get contacts linked to the same company
  const contacts = deal.company_id
    ? db.prepare(`
        SELECT ct.*, u.name as owner_name
        FROM contacts ct
        LEFT JOIN users u ON ct.owner_id = u.id
        WHERE ct.company_id = ?
        ORDER BY ct.last_name, ct.first_name
      `).all(deal.company_id)
    : [];

  // Get activities linked to this deal OR to any of the deal's company contacts
  const contactIds = contacts.map(c => c.id);
  let dealActivities;
  if (contactIds.length > 0) {
    const contactPlaceholders = contactIds.map(() => '?').join(',');
    dealActivities = db.prepare(`
      SELECT a.id, a.type, a.subject, a.description, a.created_at, a.ai_generated,
             a.is_completed, a.due_date,
             u.name as user_name, d.title as deal_title,
             ct.first_name || ' ' || ct.last_name as contact_name,
             'activity' as source
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN deals d ON a.deal_id = d.id
      LEFT JOIN contacts ct ON a.contact_id = ct.id
      WHERE a.deal_id = ? OR a.contact_id IN (${contactPlaceholders})
    `).all(req.params.id, ...contactIds);
  } else {
    dealActivities = db.prepare(`
      SELECT a.id, a.type, a.subject, a.description, a.created_at, a.ai_generated,
             a.is_completed, a.due_date,
             u.name as user_name, d.title as deal_title,
             ct.first_name || ' ' || ct.last_name as contact_name,
             'activity' as source
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN deals d ON a.deal_id = d.id
      LEFT JOIN contacts ct ON a.contact_id = ct.id
      WHERE a.deal_id = ?
    `).all(req.params.id);
  }

  // Get related emails (from/to contacts of the deal's company)
  let emailActivities = [];
  if (contacts.length > 0) {
    const contactEmails = contacts.map(c => c.email).filter(Boolean);
    if (contactEmails.length > 0) {
      const placeholders = contactEmails.map(() => '?').join(',');
      const lowerEmails = contactEmails.map(e => e.toLowerCase());
      emailActivities = db.prepare(`
        SELECT e.id, e.subject, e.from_address, e.from_name, e.to_addresses,
               e.date as created_at, e.is_inbound, 'email' as source
        FROM emails e
        WHERE LOWER(e.from_address) IN (${placeholders})
           OR EXISTS (
             SELECT 1 FROM json_each(e.to_addresses) je
             WHERE LOWER(TRIM(je.value, '"')) IN (${lowerEmails.map(() => '?').join(',')})
           )
        ORDER BY e.date DESC
      `).all(...lowerEmails, ...lowerEmails);
    }
  }

  // Merge and sort by date, newest first
  const allActivities = [
    ...dealActivities.map(a => ({
      ...a,
      sort_date: a.created_at,
    })),
    ...emailActivities.map(e => ({
      id: `email-${e.id}`,
      type: 'email',
      subject: e.subject || '(no subject)',
      description: e.is_inbound
        ? `From: ${e.from_name || e.from_address}`
        : `To: ${(() => { try { return JSON.parse(e.to_addresses).join(', '); } catch { return e.to_addresses; } })()}`,
      created_at: e.created_at,
      source: 'email',
      is_inbound: e.is_inbound,
      sort_date: e.created_at,
    })),
  ].sort((a, b) => new Date(b.sort_date) - new Date(a.sort_date));

  const total_activities = allActivities.length;
  const showAll = req.query.all_activities === '1';
  const activities = showAll ? allActivities : allActivities.slice(0, 10);

  res.json({ ...deal, contacts, activities, total_activities });
}

function create(req, res) {
  const { title, value, stage_id, company_id, contact_id, owner_id, expected_close, notes, lead_source, partner_id, priority } = req.body;
  if (!title || !stage_id) return res.status(400).json({ error: 'Title and stage required' });
  if (!company_id) return res.status(400).json({ error: 'Company is required' });

  const db = getDb();
  const ownerResolution = resolveOwnerId(db, owner_id, req.user.id);
  if (ownerResolution.error) {
    return res.status(400).json({ error: ownerResolution.error });
  }

  const resolvedPriority = resolvePriority(db, company_id, priority);
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 as next FROM deals WHERE stage_id = ?').get(stage_id);
  const result = db.prepare("INSERT INTO deals (title, value, stage_id, company_id, contact_id, owner_id, expected_close, notes, lead_source, partner_id, priority, position, stage_changed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))")
    .run(title, value || 0, stage_id, company_id || null, contact_id || null, ownerResolution.ownerId, expected_close || null, notes || null, lead_source || null, partner_id || null, resolvedPriority, maxPos.next);
  const deal = db.prepare(`
    SELECT d.*, ds.name as stage_name, c.name as company_name,
      ct.first_name || ' ' || ct.last_name as contact_name, u.name as owner_name,
      p.name as partner_name
    FROM deals d
    LEFT JOIN deal_stages ds ON d.stage_id = ds.id
    LEFT JOIN companies c ON d.company_id = c.id
    LEFT JOIN contacts ct ON d.contact_id = ct.id
    LEFT JOIN users u ON d.owner_id = u.id
    LEFT JOIN partners p ON d.partner_id = p.id
    WHERE d.id = ?
  `).get(result.lastInsertRowid);
  const sentimentDeal = refreshDealSentiment(db, deal);

  // Log deal creation activity
  db.prepare(
    "INSERT INTO activities (type, subject, description, deal_id, user_id, created_at, updated_at) VALUES ('note', ?, ?, ?, ?, datetime('now'), datetime('now'))"
  ).run(`Deal created`, `Deal "${title}" created in stage ${deal.stage_name}${deal.company_name ? ` for ${deal.company_name}` : ''}`, deal.id, req.user.id);

  res.status(201).json(sentimentDeal);
}

function update(req, res) {
  const { title, value, stage_id, company_id, contact_id, owner_id, expected_close, notes, lead_source, partner_id, priority } = req.body;
  const db = getDb();
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const ownerResolution = resolveOwnerId(db, owner_id, deal.owner_id);
  if (ownerResolution.error) {
    return res.status(400).json({ error: ownerResolution.error });
  }

  const newStageId = stage_id || deal.stage_id;
  const stageChanged = newStageId !== deal.stage_id;
  const resolvedPriority = priority !== undefined ? priority : deal.priority;
  db.prepare(`UPDATE deals SET title = ?, value = ?, stage_id = ?, company_id = ?, contact_id = ?, owner_id = ?, expected_close = ?, notes = ?, lead_source = ?, partner_id = ?, priority = ?, updated_at = datetime('now')${stageChanged ? ", stage_changed_at = datetime('now')" : ''} WHERE id = ?`)
    .run(
      title || deal.title, value !== undefined ? value : deal.value,
      newStageId,
      company_id !== undefined ? company_id : deal.company_id,
      contact_id !== undefined ? contact_id : deal.contact_id,
      ownerResolution.ownerId,
      expected_close !== undefined ? expected_close : deal.expected_close,
      notes !== undefined ? notes : deal.notes,
      lead_source !== undefined ? lead_source : deal.lead_source,
      partner_id !== undefined ? partner_id : deal.partner_id,
      resolvedPriority,
      req.params.id
    );
  const updated = db.prepare(`
    SELECT d.*, ds.name as stage_name, c.name as company_name,
      ct.first_name || ' ' || ct.last_name as contact_name, u.name as owner_name,
      p.name as partner_name
    FROM deals d LEFT JOIN deal_stages ds ON d.stage_id = ds.id
    LEFT JOIN companies c ON d.company_id = c.id
    LEFT JOIN contacts ct ON d.contact_id = ct.id
    LEFT JOIN users u ON d.owner_id = u.id
    LEFT JOIN partners p ON d.partner_id = p.id WHERE d.id = ?
  `).get(req.params.id);
  res.json(refreshDealSentiment(db, updated));
}

function updateStage(req, res) {
  const { stage_id, position } = req.body;
  if (!stage_id) return res.status(400).json({ error: 'stage_id required' });

  const db = getDb();
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const oldStage = db.prepare('SELECT name FROM deal_stages WHERE id = ?').get(deal.stage_id);
  const newStage = db.prepare('SELECT name FROM deal_stages WHERE id = ?').get(stage_id);

  const stageChanged = deal.stage_id !== stage_id;
  db.prepare(`UPDATE deals SET stage_id = ?, position = ?, updated_at = datetime('now'), lifecycle_state = 'active', closed_at = NULL, lifecycle_manual = 0${stageChanged ? ", stage_changed_at = datetime('now')" : ''} WHERE id = ?`)
    .run(stage_id, position !== undefined ? position : 0, req.params.id);

  // Log stage movement activity
  if (deal.stage_id !== stage_id) {
    db.prepare(
      "INSERT INTO activities (type, subject, description, deal_id, user_id, created_at, updated_at) VALUES ('note', ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).run('Stage changed', `Moved from ${oldStage?.name || 'Unknown'} to ${newStage?.name || 'Unknown'}`, req.params.id, req.user.id);
  }

  res.json({ message: 'Stage updated' });
}

function updateLifecycle(req, res) {
  const { lifecycle_state } = req.body;
  if (!lifecycle_state || !['active', 'closed'].includes(lifecycle_state)) {
    return res.status(400).json({ error: 'lifecycle_state must be "active" or "closed"' });
  }
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Only admins and managers can change deal lifecycle state' });
  }

  const db = getDb();
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const closedAt = lifecycle_state === 'closed' ? "datetime('now')" : 'NULL';
  db.prepare(`UPDATE deals SET lifecycle_state = ?, lifecycle_manual = 1, closed_at = ${closedAt}, updated_at = datetime('now') WHERE id = ?`)
    .run(lifecycle_state, req.params.id);

  db.prepare(
    "INSERT INTO activities (type, subject, description, deal_id, user_id, created_at, updated_at) VALUES ('note', ?, ?, ?, ?, datetime('now'), datetime('now'))"
  ).run(
    lifecycle_state === 'closed' ? 'Deal closed' : 'Deal reopened',
    lifecycle_state === 'closed' ? 'Deal manually closed by admin' : 'Deal manually reopened by admin',
    req.params.id,
    req.user.id
  );

  res.json({ message: `Deal ${lifecycle_state === 'closed' ? 'closed' : 'reopened'}` });
}

function merge(req, res) {
  const { source_deal_id } = req.body;
  const targetDealId = parseInt(req.params.id);
  if (!source_deal_id) return res.status(400).json({ error: 'source_deal_id is required' });
  const sourceDealId = parseInt(source_deal_id);
  if (sourceDealId === targetDealId) return res.status(400).json({ error: 'Cannot merge a deal into itself' });
  if (req.user.role !== 'admin' && req.user.role !== 'manager') return res.status(403).json({ error: 'Only admins and managers can merge deals' });

  const db = getDb();
  const target = db.prepare('SELECT * FROM deals WHERE id = ?').get(targetDealId);
  const source = db.prepare('SELECT d.*, ds.name as stage_name FROM deals d LEFT JOIN deal_stages ds ON ds.id = d.stage_id WHERE d.id = ?').get(sourceDealId);
  if (!target) return res.status(404).json({ error: 'Target deal not found' });
  if (!source) return res.status(404).json({ error: 'Source deal not found' });

  // Move all activities from source to target
  db.prepare('UPDATE activities SET deal_id = ? WHERE deal_id = ?').run(targetDealId, sourceDealId);

  // Take the higher value if target has no value
  if ((!target.value || target.value === 0) && source.value > 0) {
    db.prepare('UPDATE deals SET value = ? WHERE id = ?').run(source.value, targetDealId);
  }

  // Fill in missing fields on target from source
  const fillFields = ['company_id', 'contact_id', 'partner_id', 'lead_source', 'expected_close', 'notes', 'priority'];
  for (const field of fillFields) {
    if (!target[field] && source[field]) {
      db.prepare(`UPDATE deals SET ${field} = ? WHERE id = ?`).run(source[field], targetDealId);
    }
  }

  // Log the merge as an activity
  db.prepare(
    "INSERT INTO activities (type, subject, description, deal_id, user_id, created_at, updated_at) VALUES ('note', ?, ?, ?, ?, datetime('now'), datetime('now'))"
  ).run('Deals merged', `Merged deal "${source.title}" (${source.stage_name || 'Unknown'} stage) into this deal`, targetDealId, req.user.id);

  // Delete the source deal
  db.prepare('DELETE FROM deals WHERE id = ?').run(sourceDealId);

  res.json({ message: `Deal "${source.title}" merged into "${target.title}"` });
}

function remove(req, res) {
  const db = getDb();
  const result = db.prepare('DELETE FROM deals WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Deal not found' });
  res.json({ message: 'Deal deleted' });
}

module.exports = { getOwners, getAll, getPipeline, getById, create, update, updateStage, updateLifecycle, merge, remove };
