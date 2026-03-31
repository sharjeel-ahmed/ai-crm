const { getDb } = require('../db/connection');

function normalizeEmailAddress(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const match = trimmed.match(/<([^>]+)>/);
  return (match ? match[1] : trimmed).trim().toLowerCase() || null;
}

function parseEmailArray(value) {
  if (!value) return [];

  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value.split(',');
    }
  }

  const values = Array.isArray(parsed) ? parsed : [parsed];
  return values
    .map(normalizeEmailAddress)
    .filter(Boolean);
}

function getActiveUserByEmail(db, email) {
  const normalizedEmail = normalizeEmailAddress(email);
  if (!normalizedEmail) return null;

  return db.prepare(`
    SELECT u.id, u.name, u.email, u.role
    FROM users u
    LEFT JOIN email_accounts ea
      ON ea.user_id = u.id
     AND LOWER(ea.email_address) = ?
    WHERE u.is_active = 1
      AND (LOWER(u.email) = ? OR ea.id IS NOT NULL)
    ORDER BY CASE WHEN LOWER(u.email) = ? THEN 0 ELSE 1 END, u.id
    LIMIT 1
  `).get(normalizedEmail, normalizedEmail, normalizedEmail);
}

function getOwnerById(db, ownerId) {
  if (!ownerId) return null;
  return db.prepare('SELECT id, name, email, role FROM users WHERE id = ? AND is_active = 1').get(ownerId);
}

function resolveDealOwnerId(db, emailId, fallbackOwnerId) {
  const fallbackOwner = getOwnerById(db, fallbackOwnerId);
  if (!emailId) return fallbackOwner?.id || fallbackOwnerId;

  const email = db.prepare(`
    SELECT e.from_address, e.to_addresses, ea.user_id AS mailbox_user_id
    FROM emails e
    LEFT JOIN email_accounts ea ON ea.id = e.email_account_id
    WHERE e.id = ?
  `).get(emailId);

  if (!email) return fallbackOwner?.id || fallbackOwnerId;

  const candidateUserIds = [];
  const seen = new Set();

  const addCandidate = (userId) => {
    if (!userId || seen.has(userId)) return;
    const owner = getOwnerById(db, userId);
    if (!owner) return;
    seen.add(userId);
    candidateUserIds.push(userId);
  };

  addCandidate(getActiveUserByEmail(db, email.from_address)?.id);
  addCandidate(email.mailbox_user_id);

  for (const address of parseEmailArray(email.to_addresses)) {
    addCandidate(getActiveUserByEmail(db, address)?.id);
  }

  if (candidateUserIds.length > 0) {
    return candidateUserIds[0];
  }

  return fallbackOwner?.id || fallbackOwnerId;
}

function getAll(req, res) {
  const db = getDb();
  const { status, type, min_confidence, max_confidence, limit = 50, offset = 0 } = req.query;

  let where = [];
  let params = [];

  if (status) {
    where.push('s.status = ?');
    params.push(status);
  }
  if (type) {
    where.push('s.type = ?');
    params.push(type);
  }
  if (min_confidence) {
    where.push('s.confidence >= ?');
    params.push(parseFloat(min_confidence));
  }
  if (max_confidence) {
    where.push('s.confidence <= ?');
    params.push(parseFloat(max_confidence));
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const suggestions = db.prepare(`
    SELECT s.*, e.subject as email_subject, e.from_address as email_from, e.from_name as email_from_name, e.date as email_date
    FROM ai_suggestions s
    LEFT JOIN emails e ON s.email_id = e.id
    ${whereClause}
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset));

  const countRow = db.prepare(`SELECT COUNT(*) as count FROM ai_suggestions s ${whereClause}`).get(...params);

  res.json({ suggestions, total: countRow.count });
}

function getStats(req, res) {
  const db = getDb();
  const stats = {
    pending: db.prepare("SELECT COUNT(*) as count FROM ai_suggestions WHERE status = 'pending'").get().count,
    approved: db.prepare("SELECT COUNT(*) as count FROM ai_suggestions WHERE status = 'approved'").get().count,
    auto_approved: db.prepare("SELECT COUNT(*) as count FROM ai_suggestions WHERE status = 'auto_approved'").get().count,
    dismissed: db.prepare("SELECT COUNT(*) as count FROM ai_suggestions WHERE status = 'dismissed'").get().count,
  };
  res.json(stats);
}

function approve(req, res) {
  const db = getDb();
  const { id } = req.params;

  const suggestion = db.prepare('SELECT * FROM ai_suggestions WHERE id = ?').get(id);
  if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });
  if (suggestion.status !== 'pending') return res.status(400).json({ error: 'Suggestion already resolved' });

  const data = JSON.parse(suggestion.data);
  // Get email date so activities reflect when the email was sent
  const email = suggestion.email_id ? db.prepare('SELECT date FROM emails WHERE id = ?').get(suggestion.email_id) : null;
  const entityResult = applySuggestion(db, suggestion.type, data, req.user.id, email?.date, suggestion.email_id);

  db.prepare(
    "UPDATE ai_suggestions SET status = 'approved', resolved_by = ?, created_entity_type = ?, created_entity_id = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(req.user.id, entityResult.type, entityResult.id, id);

  res.json({ success: true, entity: entityResult });
}

function approveWithEdits(req, res) {
  const db = getDb();
  const { id } = req.params;
  const { data: editedData } = req.body;

  const suggestion = db.prepare('SELECT * FROM ai_suggestions WHERE id = ?').get(id);
  if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });
  if (suggestion.status !== 'pending') return res.status(400).json({ error: 'Suggestion already resolved' });

  // Update suggestion data with edits
  db.prepare("UPDATE ai_suggestions SET data = ? WHERE id = ?").run(JSON.stringify(editedData), id);

  const email = suggestion.email_id ? db.prepare('SELECT date FROM emails WHERE id = ?').get(suggestion.email_id) : null;
  const entityResult = applySuggestion(db, suggestion.type, editedData, req.user.id, email?.date, suggestion.email_id);

  db.prepare(
    "UPDATE ai_suggestions SET status = 'approved', resolved_by = ?, created_entity_type = ?, created_entity_id = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(req.user.id, entityResult.type, entityResult.id, id);

  res.json({ success: true, entity: entityResult });
}

function dismiss(req, res) {
  const db = getDb();
  const { id } = req.params;

  const suggestion = db.prepare('SELECT * FROM ai_suggestions WHERE id = ?').get(id);
  if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });
  if (suggestion.status !== 'pending') return res.status(400).json({ error: 'Suggestion already resolved' });

  db.prepare(
    "UPDATE ai_suggestions SET status = 'dismissed', resolved_by = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(req.user.id, id);

  res.json({ success: true });
}

function bulkApprove(req, res) {
  const db = getDb();
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });

  const results = [];
  for (const id of ids) {
    const suggestion = db.prepare('SELECT * FROM ai_suggestions WHERE id = ? AND status = ?').get(id, 'pending');
    if (!suggestion) continue;

    const data = JSON.parse(suggestion.data);
    const email = suggestion.email_id ? db.prepare('SELECT date FROM emails WHERE id = ?').get(suggestion.email_id) : null;
    const entityResult = applySuggestion(db, suggestion.type, data, req.user.id, email?.date, suggestion.email_id);

    db.prepare(
      "UPDATE ai_suggestions SET status = 'approved', resolved_by = ?, created_entity_type = ?, created_entity_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(req.user.id, entityResult.type, entityResult.id, id);

    results.push({ id, entity: entityResult });
  }

  res.json({ success: true, results });
}

function bulkDismiss(req, res) {
  const db = getDb();
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });

  const stmt = db.prepare(
    "UPDATE ai_suggestions SET status = 'dismissed', resolved_by = ?, updated_at = datetime('now') WHERE id = ? AND status = 'pending'"
  );

  let count = 0;
  for (const id of ids) {
    const result = stmt.run(req.user.id, id);
    count += result.changes;
  }

  res.json({ success: true, dismissed: count });
}

function findOrCreateCompany(db, companyName, data, userId) {
  if (!companyName) return null;
  const findOrCreate = db.transaction(() => {
    // Case-insensitive dedup
    const existing = db.prepare('SELECT id FROM companies WHERE LOWER(name) = LOWER(?)').get(companyName);
    if (existing) return existing.id;

    const result = db.prepare(
      "INSERT INTO companies (name, industry, website, phone, address, created_by, ai_generated, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))"
    ).run(companyName, data.industry || '', data.website || '', data.phone || '', data.address || '', userId);
    return result.lastInsertRowid;
  });
  return findOrCreate();
}

function applySuggestion(db, type, data, userId, emailDate, emailId) {
  // Use email date for activity timestamps so timeline reflects when things actually happened
  const tsValue = emailDate || new Date().toISOString().replace('T', ' ').substring(0, 19);
  switch (type) {
    case 'create_contact': {
      const createContact = db.transaction(() => {
        // Dedup by email
        if (data.email) {
          const existing = db.prepare('SELECT id FROM contacts WHERE LOWER(email) = LOWER(?)').get(data.email);
          if (existing) return { type: 'contact', id: existing.id, deduplicated: true };
        }
        // Link to company if company_name provided
        let companyId = data.company_id || null;
        if (!companyId && data.company_name) {
          companyId = findOrCreateCompany(db, data.company_name, {}, userId);
        }
        const result = db.prepare(
          "INSERT INTO contacts (first_name, last_name, email, phone, job_title, company_id, owner_id, lead_source, ai_generated, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))"
        ).run(data.first_name || '', data.last_name || '', data.email || '', data.phone || '', data.job_title || '', companyId, userId, data.lead_source || 'ai_email');
        return { type: 'contact', id: result.lastInsertRowid };
      });
      return createContact();
    }
    case 'create_company': {
      const createCompany = db.transaction(() => {
        // Dedup by name (case-insensitive)
        if (data.name) {
          const existing = db.prepare('SELECT id FROM companies WHERE LOWER(name) = LOWER(?)').get(data.name);
          if (existing) return { type: 'company', id: existing.id, deduplicated: true };
        }
        const result = db.prepare(
          "INSERT INTO companies (name, industry, website, phone, address, created_by, ai_generated, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))"
        ).run(data.name || '', data.industry || '', data.website || '', data.phone || '', data.address || '', userId);
        return { type: 'company', id: result.lastInsertRowid };
      });
      return createCompany();
    }
    case 'create_deal': {
      // Use transaction to prevent race condition duplicates
      const createDeal = db.transaction(() => {
        // Dedup by title (case-insensitive)
        if (data.title) {
          const existing = db.prepare('SELECT id FROM deals WHERE LOWER(title) = LOWER(?)').get(data.title);
          if (existing) return { type: 'deal', id: existing.id, deduplicated: true };
        }
        // Link to company — resolve from company_name, or extract from title pattern "X <> CompanyName"
        let companyId = data.company_id || null;
        let companyName = data.company_name || null;
        if (!companyId && !companyName && data.title) {
          const match = data.title.match(/<>\s*(.+)$/);
          if (match) companyName = match[1].trim();
        }
        if (!companyId && companyName) {
          companyId = findOrCreateCompany(db, companyName, {}, userId);
        }
        // Find contact by email if provided
        let contactId = data.contact_id || null;
        if (!contactId && data.contact_email) {
          const contact = db.prepare('SELECT id FROM contacts WHERE LOWER(email) = LOWER(?)').get(data.contact_email);
          if (contact) contactId = contact.id;
        }
        // Resolve stage_name to stage_id
        let stageId = data.stage_id || null;
        if (!stageId && data.stage_name) {
          const stage = db.prepare('SELECT id FROM deal_stages WHERE LOWER(name) = LOWER(?)').get(data.stage_name);
          if (stage) stageId = stage.id;
        }
        if (!stageId) {
          const firstStage = db.prepare('SELECT id FROM deal_stages ORDER BY display_order ASC LIMIT 1').get();
          stageId = firstStage?.id || 1;
        }
        // Resolve partner_id from partner_name if provided
        let partnerId = data.partner_id || null;
        if (!partnerId && data.partner_name) {
          const partner = db.prepare('SELECT id FROM partners WHERE LOWER(name) = LOWER(?)').get(data.partner_name);
          if (partner) partnerId = partner.id;
        }
        const ownerId = resolveDealOwnerId(db, emailId, userId);
        // Auto-resolve priority based on company attributes
        let priority = data.priority || 'medium';
        if (companyId && priority === 'medium') {
          const comp = db.prepare('SELECT country, is_fortune_500 FROM companies WHERE id = ?').get(companyId);
          if (comp) {
            const isUS = comp.country && comp.country.toLowerCase().match(/^(us|usa|united states|united states of america)$/);
            if (isUS || comp.is_fortune_500) priority = 'high';
          }
        }
        const result = db.prepare(
          "INSERT INTO deals (title, value, stage_id, company_id, contact_id, owner_id, lead_source, partner_id, ai_generated, notes, priority, created_at, updated_at, stage_changed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'), datetime('now'), ?)"
        ).run(data.title || '', parseFloat(data.value) || 0, stageId, companyId, contactId, ownerId, data.lead_source || 'ai_email', partnerId, data.notes || '', priority, tsValue);

        // Log deal creation activity
        const stageName = db.prepare('SELECT name FROM deal_stages WHERE id = ?').get(stageId)?.name || 'Unknown';
        db.prepare(
          "INSERT INTO activities (type, subject, description, deal_id, user_id, ai_generated, created_at, updated_at) VALUES ('note', ?, ?, ?, ?, 1, ?, ?)"
        ).run('Deal created by AI', `Deal "${data.title}" created in stage ${stageName}${data.company_name ? ` for ${data.company_name}` : ''}`, result.lastInsertRowid, userId, tsValue, tsValue);

        return { type: 'deal', id: result.lastInsertRowid };
      });
      return createDeal();
    }
    case 'log_activity': {
      // Resolve deal_id and contact_id from company_name if not provided
      let dealId = data.deal_id || null;
      let contactId = data.contact_id || null;
      if (!dealId && data.company_name) {
        const company = db.prepare('SELECT id FROM companies WHERE LOWER(name) = LOWER(?)').get(data.company_name);
        if (company) {
          const deal = db.prepare('SELECT id FROM deals WHERE company_id = ? ORDER BY updated_at DESC LIMIT 1').get(company.id);
          if (deal) dealId = deal.id;
          if (!contactId) {
            const contact = db.prepare('SELECT id FROM contacts WHERE company_id = ? ORDER BY updated_at DESC LIMIT 1').get(company.id);
            if (contact) contactId = contact.id;
          }
        }
      }
      // Fallback: try to find deal from subject pattern "Pazo <> Company"
      if (!dealId && data.subject) {
        const match = data.subject.match(/Pazo\s*<>\s*(.+)/i);
        if (match) {
          const deal = db.prepare('SELECT id FROM deals WHERE LOWER(title) = LOWER(?)').get(match[0].trim());
          if (deal) dealId = deal.id;
        }
      }
      const result = db.prepare(
        "INSERT INTO activities (type, subject, description, deal_id, contact_id, user_id, ai_generated, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)"
      ).run(data.type || 'email', data.subject || '', data.description || '', dealId, contactId, userId, tsValue, tsValue);
      return { type: 'activity', id: result.lastInsertRowid };
    }
    case 'update_contact': {
      if (!data.contact_id) return { type: 'contact', id: null };
      const updates = [];
      const params = [];
      for (const field of ['first_name', 'last_name', 'email', 'phone', 'job_title']) {
        if (data[field] !== undefined) {
          updates.push(`${field} = ?`);
          params.push(data[field]);
        }
      }
      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')");
        params.push(data.contact_id);
        db.prepare(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }
      return { type: 'contact', id: data.contact_id };
    }
    case 'move_deal_stage': {
      // Resolve deal_title to deal_id if needed
      let dealId = data.deal_id || null;
      if (!dealId && data.deal_title) {
        const deal = db.prepare('SELECT id FROM deals WHERE LOWER(title) = LOWER(?)').get(data.deal_title);
        if (deal) dealId = deal.id;
      }
      // Resolve stage_name to stage_id if needed
      let stageId = data.stage_id || null;
      if (!stageId && data.stage_name) {
        const stage = db.prepare('SELECT id FROM deal_stages WHERE LOWER(name) = LOWER(?)').get(data.stage_name);
        if (stage) stageId = stage.id;
      }
      if (!dealId || !stageId) return { type: 'deal', id: null };
      const oldDeal = db.prepare('SELECT stage_id FROM deals WHERE id = ?').get(dealId);
      const oldStageName = oldDeal ? db.prepare('SELECT name FROM deal_stages WHERE id = ?').get(oldDeal.stage_id)?.name : 'Unknown';
      const newStageName = db.prepare('SELECT name FROM deal_stages WHERE id = ?').get(stageId)?.name || 'Unknown';

      db.prepare("UPDATE deals SET stage_id = ?, updated_at = datetime('now'), stage_changed_at = ? WHERE id = ?").run(stageId, tsValue, dealId);

      // Log stage movement activity
      db.prepare(
        "INSERT INTO activities (type, subject, description, deal_id, user_id, ai_generated, created_at, updated_at) VALUES ('note', ?, ?, ?, ?, 1, ?, ?)"
      ).run('Stage changed by AI', `Moved from ${oldStageName} to ${newStageName}`, dealId, userId, tsValue, tsValue);

      return { type: 'deal', id: dealId };
    }
    case 'newsletter_detected': {
      const senderEmail = (data.sender_email || '').toLowerCase().trim();
      if (senderEmail) {
        const existing = db.prepare('SELECT id FROM email_ignore_list WHERE LOWER(email_address) = ?').get(senderEmail);
        if (!existing) {
          const reason = `Newsletter confirmed: ${data.newsletter_name || 'Unknown'}`;
          db.prepare('INSERT INTO email_ignore_list (email_address, reason) VALUES (?, ?)').run(senderEmail, reason);
        }
      }
      return { type: 'ignore_list', id: null };
    }
    default:
      return { type: null, id: null };
  }
}

module.exports = { getAll, getStats, approve, approveWithEdits, dismiss, bulkApprove, bulkDismiss, applySuggestion };
