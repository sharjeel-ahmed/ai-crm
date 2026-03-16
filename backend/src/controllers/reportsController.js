const { getDb } = require('../db/connection');
const { syncDealLifecycleStates } = require('../services/deals/lifecycle');

function formatSqlDate(date, endOfDay = false) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const time = endOfDay ? '23:59:59' : '00:00:00';
  return `${year}-${month}-${day} ${time}`;
}

function getDateRange(req) {
  const preset = req.query.preset || 'last_week';
  const today = new Date();
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  if (req.query.start_date && req.query.end_date) {
    const start = new Date(req.query.start_date);
    const customEnd = new Date(req.query.end_date);
    customEnd.setHours(23, 59, 59, 999);
    return {
      preset: 'custom',
      startSql: formatSqlDate(start),
      endSql: formatSqlDate(customEnd, true),
      startDate: start,
      endDate: customEnd,
    };
  }

  const start = new Date(end);
  if (preset === 'last_month') {
    start.setDate(start.getDate() - 29);
  } else if (preset === 'last_quarter') {
    start.setDate(start.getDate() - 89);
  } else {
    start.setDate(start.getDate() - 6);
  }
  start.setHours(0, 0, 0, 0);

  return {
    preset,
    startSql: formatSqlDate(start),
    endSql: formatSqlDate(end, true),
    startDate: start,
    endDate: end,
  };
}

function getScope(req, alias = 'd') {
  if (req.user.role === 'sales_rep') {
    return { clause: `AND ${alias}.owner_id = ?`, params: [req.user.id] };
  }
  if (req.query.my_deals === 'true') {
    return { clause: `AND ${alias}.owner_id = ?`, params: [req.user.id] };
  }
  if (req.query.owner_id) {
    return { clause: `AND ${alias}.owner_id = ?`, params: [parseInt(req.query.owner_id)] };
  }
  return { clause: '', params: [] };
}

function getSummary(req, res) {
  const db = getDb();
  syncDealLifecycleStates(db);
  const range = getDateRange(req);
  const scope = getScope(req);

  const newDeals = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(d.value), 0) AS value
    FROM deals d
    WHERE d.created_at >= ? AND d.created_at <= ? ${scope.clause}
  `).get(range.startSql, range.endSql, ...scope.params);

  const wins = db.prepare(`
    SELECT COUNT(*) AS count,
           COALESCE(SUM(d.value), 0) AS value,
           COALESCE(AVG(julianday(COALESCE(d.stage_changed_at, d.updated_at, d.created_at)) - julianday(d.created_at)), 0) AS avg_cycle_days
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE ds.name = 'Won'
      AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ?
      AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) <= ?
      ${scope.clause}
  `).get(range.startSql, range.endSql, ...scope.params);

  const losses = db.prepare(`
    SELECT COUNT(*) AS count
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE ds.name = 'Lost'
      AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ?
      AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) <= ?
      ${scope.clause}
  `).get(range.startSql, range.endSql, ...scope.params);

  const activePipeline = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(d.value), 0) AS value
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE ds.is_closed = 0
      AND d.created_at <= ?
      ${scope.clause}
  `).get(range.endSql, ...scope.params);

  const staleDeals = db.prepare(`
    SELECT COUNT(*) AS count
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE ds.is_closed = 0
      AND julianday('now') - julianday(COALESCE(d.stage_changed_at, d.created_at)) >= 14
      ${scope.clause}
  `).get(...scope.params);

  const inactiveDeals = db.prepare(`
    SELECT COUNT(*) AS count
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    LEFT JOIN activities a ON a.deal_id = d.id AND a.created_at >= ? AND a.created_at <= ?
    WHERE ds.is_closed = 0
      ${scope.clause}
    GROUP BY d.id
    HAVING COUNT(a.id) = 0
  `).all(range.startSql, range.endSql, ...scope.params).length;

  const closedCount = wins.count + losses.count;
  const winRate = closedCount > 0 ? (wins.count / closedCount) * 100 : 0;

  res.json({
    range: {
      preset: range.preset,
      start_date: range.startSql,
      end_date: range.endSql,
    },
    newDeals: newDeals.count,
    newPipelineValue: newDeals.value,
    wonDeals: wins.count,
    wonValue: wins.value,
    lostDeals: losses.count,
    winRate,
    avgSalesCycleDays: Math.round(wins.avg_cycle_days || 0),
    activePipelineDeals: activePipeline.count,
    activePipelineValue: activePipeline.value,
    staleDeals: staleDeals.count,
    inactiveDeals,
  });
}

function pipelineValue(req, res) {
  const db = getDb();
  syncDealLifecycleStates(db);
  const range = getDateRange(req);
  const scope = getScope(req);

  const data = db.prepare(`
    SELECT ds.name AS stage,
           ds.display_order,
           COUNT(d.id) AS count,
           COALESCE(SUM(d.value), 0) AS value
    FROM deal_stages ds
    LEFT JOIN deals d
      ON ds.id = d.stage_id
     AND d.created_at >= ?
     AND d.created_at <= ?
     ${scope.clause ? `AND d.owner_id = ?` : ''}
    GROUP BY ds.id
    ORDER BY ds.display_order
  `).all(range.startSql, range.endSql, ...scope.params);

  res.json(data);
}

function repPerformance(req, res) {
  const db = getDb();
  syncDealLifecycleStates(db);
  const range = getDateRange(req);

  if (req.user.role === 'sales_rep') {
    const ownRecord = db.prepare(`
      SELECT u.id AS user_id, u.name,
        (SELECT COUNT(*) FROM deals d WHERE d.owner_id = u.id AND d.created_at >= ? AND d.created_at <= ?) AS total_deals,
        (SELECT COALESCE(SUM(d.value), 0) FROM deals d WHERE d.owner_id = u.id AND d.created_at >= ? AND d.created_at <= ?) AS total_value,
        (SELECT COUNT(*) FROM deals d JOIN deal_stages ds ON ds.id = d.stage_id
          WHERE d.owner_id = u.id AND ds.name = 'Won' AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ? AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) <= ?) AS won_deals,
        (SELECT COALESCE(SUM(d.value), 0) FROM deals d JOIN deal_stages ds ON ds.id = d.stage_id
          WHERE d.owner_id = u.id AND ds.name = 'Won' AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ? AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) <= ?) AS won_value,
        (SELECT COUNT(*) FROM deals d JOIN deal_stages ds ON ds.id = d.stage_id
          WHERE d.owner_id = u.id AND ds.name = 'Lost' AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ? AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) <= ?) AS lost_deals,
        (SELECT COALESCE(AVG(julianday(COALESCE(d.stage_changed_at, d.updated_at, d.created_at)) - julianday(d.created_at)), 0) FROM deals d JOIN deal_stages ds ON ds.id = d.stage_id
          WHERE d.owner_id = u.id AND ds.name = 'Won' AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ? AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) <= ?) AS avg_cycle_days,
        (SELECT COALESCE(SUM(d.value), 0) FROM deals d JOIN deal_stages ds ON ds.id = d.stage_id
          WHERE d.owner_id = u.id AND ds.is_closed = 0) AS open_value
      FROM users u
      WHERE u.id = ?
    `).get(
      range.startSql, range.endSql,
      range.startSql, range.endSql,
      range.startSql, range.endSql,
      range.startSql, range.endSql,
      range.startSql, range.endSql,
      range.startSql, range.endSql,
      req.user.id
    );
    return res.json(ownRecord ? [ownRecord] : []);
  }

  const users = db.prepare(`
    SELECT id AS user_id, name
    FROM users
    WHERE role IN ('sales_rep', 'manager') AND is_active = 1
    ORDER BY name
  `).all();

  const result = users.map((user) => {
    const totalDeals = db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(value), 0) AS value FROM deals d WHERE owner_id = ? AND created_at >= ? AND created_at <= ?')
      .get(user.user_id, range.startSql, range.endSql);
    const won = db.prepare(`
      SELECT COUNT(*) AS count, COALESCE(SUM(d.value), 0) AS value,
             COALESCE(AVG(julianday(COALESCE(d.stage_changed_at, d.updated_at, d.created_at)) - julianday(d.created_at)), 0) AS avg_cycle_days
      FROM deals d
      JOIN deal_stages ds ON ds.id = d.stage_id
      WHERE d.owner_id = ? AND ds.name = 'Won'
        AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ?
        AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) <= ?
    `).get(user.user_id, range.startSql, range.endSql);
    const lost = db.prepare(`
      SELECT COUNT(*) AS count
      FROM deals d
      JOIN deal_stages ds ON ds.id = d.stage_id
      WHERE d.owner_id = ? AND ds.name = 'Lost'
        AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ?
        AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) <= ?
    `).get(user.user_id, range.startSql, range.endSql);
    const open = db.prepare(`
      SELECT COALESCE(SUM(d.value), 0) AS value
      FROM deals d
      JOIN deal_stages ds ON ds.id = d.stage_id
      WHERE d.owner_id = ? AND ds.is_closed = 0
    `).get(user.user_id);

    return {
      user_id: user.user_id,
      name: user.name,
      total_deals: totalDeals.count,
      total_value: totalDeals.value,
      won_deals: won.count,
      won_value: won.value,
      lost_deals: lost.count,
      avg_cycle_days: Math.round(won.avg_cycle_days || 0),
      open_value: open.value,
    };
  }).sort((a, b) => b.won_value - a.won_value);

  res.json(result);
}

function dealAging(req, res) {
  const db = getDb();
  syncDealLifecycleStates(db);
  const range = getDateRange(req);
  const scope = getScope(req);

  const deals = db.prepare(`
    SELECT d.id, d.title, d.value, d.stage_changed_at, d.created_at, d.updated_at,
      ds.name AS stage, ds.display_order
    FROM deals d
    JOIN deal_stages ds ON d.stage_id = ds.id
    WHERE ds.is_closed = 0
      AND d.created_at <= ?
      ${scope.clause}
    ORDER BY ds.display_order
  `).all(range.endSql, ...scope.params);

  const now = Date.now();
  const stageMap = {};
  for (const d of deals) {
    const dateStr = d.stage_changed_at || d.updated_at || d.created_at;
    const parsed = new Date(dateStr);
    const days = isNaN(parsed) ? 0 : Math.max(0, Math.floor((now - parsed.getTime()) / 86400000));

    if (!stageMap[d.stage]) {
      stageMap[d.stage] = { stage: d.stage, display_order: d.display_order, avg_days: 0, max_days: 0, deal_count: 0, total_days: 0, deals: [] };
    }
    const stage = stageMap[d.stage];
    stage.total_days += days;
    stage.deal_count += 1;
    if (days > stage.max_days) stage.max_days = days;
    stage.deals.push({ id: d.id, title: d.title, value: d.value, days_in_stage: days });
  }

  const result = Object.values(stageMap)
    .map((stage) => ({ ...stage, avg_days: stage.deal_count ? Math.round(stage.total_days / stage.deal_count) : 0 }))
    .sort((a, b) => a.display_order - b.display_order);

  res.json(result);
}

function attention(req, res) {
  const db = getDb();
  syncDealLifecycleStates(db);
  const range = getDateRange(req);
  const scope = getScope(req);

  const rows = db.prepare(`
    SELECT d.id, d.title, d.value, d.sentiment, d.stage_changed_at, d.created_at,
           ds.name AS stage_name, c.name AS company_name, u.name AS owner_name,
           MAX(a.created_at) AS last_activity_at
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    LEFT JOIN companies c ON c.id = d.company_id
    LEFT JOIN users u ON u.id = d.owner_id
    LEFT JOIN activities a ON a.deal_id = d.id
    WHERE ds.is_closed = 0
      AND d.created_at <= ?
      ${scope.clause}
    GROUP BY d.id
  `).all(range.endSql, ...scope.params);

  const now = Date.now();
  const items = rows.map((row) => {
    const stageDate = new Date(row.stage_changed_at || row.created_at);
    const lastActivity = row.last_activity_at ? new Date(row.last_activity_at) : null;
    const daysInStage = isNaN(stageDate) ? 0 : Math.max(0, Math.floor((now - stageDate.getTime()) / 86400000));
    const noRecentActivity = !lastActivity || lastActivity < new Date(range.startSql);
    const score =
      (row.sentiment === 'negative' ? 50 : 0) +
      (noRecentActivity ? 25 : 0) +
      Math.min(daysInStage, 30);

    return {
      ...row,
      days_in_stage: daysInStage,
      no_recent_activity: noRecentActivity,
      priority_score: score,
    };
  }).sort((a, b) => b.priority_score - a.priority_score);

  res.json(items.slice(0, 10));
}

function dashboard(req, res) {
  const db = getDb();
  syncDealLifecycleStates(db);
  const isScoped = req.user.role === 'sales_rep' || req.query.my_deals === 'true' || req.query.owner_id;
  const scopedUserId = req.query.owner_id ? parseInt(req.query.owner_id) : req.user.id;
  const ownerClause = isScoped ? ' AND d.owner_id = ?' : '';
  const ownerParams = isScoped ? [scopedUserId] : [];
  const activeDealFilter = `COALESCE(d.lifecycle_state, 'active') != 'closed'`;
  const sevenDaysAgo = formatSqlDate(new Date(Date.now() - (6 * 86400000)));
  const thirtyDaysAgo = formatSqlDate(new Date(Date.now() - (29 * 86400000)));

  const fourteenDaysAgo = formatSqlDate(new Date(Date.now() - (13 * 86400000)));
  const sixtyDaysAgo = formatSqlDate(new Date(Date.now() - (59 * 86400000)));

  const snapshot = db.prepare(`
    SELECT
      COUNT(*) AS total_deals,
      COALESCE(SUM(d.value), 0) AS total_value,
      SUM(CASE WHEN ds.is_closed = 0 THEN 1 ELSE 0 END) AS open_deals,
      COALESCE(SUM(CASE WHEN ds.is_closed = 0 THEN d.value ELSE 0 END), 0) AS open_value,
      COALESCE(SUM(CASE WHEN ds.is_closed = 0 THEN d.value * COALESCE(ds.win_probability, 50) / 100.0 ELSE 0 END), 0) AS weighted_pipeline_value,
      SUM(CASE WHEN ds.name = 'Lead' THEN 1 ELSE 0 END) AS lead_stage_deals,
      COALESCE(SUM(CASE WHEN ds.name = 'Lead' THEN d.value ELSE 0 END), 0) AS lead_stage_value,
      SUM(CASE WHEN ds.is_closed = 0 AND d.sentiment = 'negative' THEN 1 ELSE 0 END) AS negative_sentiment_deals,
      SUM(CASE WHEN ds.is_closed = 0 AND julianday('now') - julianday(COALESCE(d.stage_changed_at, d.updated_at, d.created_at)) >= 14 THEN 1 ELSE 0 END) AS stale_deals
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE ${activeDealFilter}${ownerClause}
  `).get(...ownerParams);

  const noActivityWindow = db.prepare(`
    SELECT COUNT(*) AS count
    FROM (
      SELECT d.id
      FROM deals d
      JOIN deal_stages ds ON ds.id = d.stage_id
      LEFT JOIN activities a ON a.deal_id = d.id AND a.created_at >= ?
      WHERE ds.is_closed = 0
        AND ${activeDealFilter}${ownerClause}
      GROUP BY d.id
      HAVING COUNT(a.id) = 0
    )
  `).get(sevenDaysAgo, ...ownerParams);

  const recentCreated = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(d.value), 0) AS value
    FROM deals d
    WHERE ${activeDealFilter}
      AND d.created_at >= ?${ownerClause}
  `).get(sevenDaysAgo, ...ownerParams);

  const newLeadsLast7Days = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(d.value), 0) AS value
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE ds.name = 'Lead'
      AND ${activeDealFilter}
      AND d.created_at >= ?${ownerClause}
  `).get(sevenDaysAgo, ...ownerParams);

  const recentWon = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(d.value), 0) AS value
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE ds.name = 'Won'
      AND ${activeDealFilter}
      AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ?${ownerClause}
  `).get(thirtyDaysAgo, ...ownerParams);

  const recentLost = db.prepare(`
    SELECT COUNT(*) AS count
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE ds.name = 'Lost'
      AND ${activeDealFilter}
      AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ?${ownerClause}
  `).get(thirtyDaysAgo, ...ownerParams);

  const recentActivities = db.prepare(`
    SELECT a.id, a.type, a.subject, a.created_at, u.name AS user_name, d.title AS deal_title
    FROM activities a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN deals d ON d.id = a.deal_id
    WHERE (d.id IS NULL OR COALESCE(d.lifecycle_state, 'active') != 'closed')
      ${isScoped ? 'AND (d.owner_id = ? OR a.user_id = ?)' : ''}
    ORDER BY a.created_at DESC
    LIMIT 8
  `).all(...(isScoped ? [scopedUserId, scopedUserId] : []));

  const leadSources = db.prepare(`
    SELECT COALESCE(NULLIF(TRIM(d.lead_source), ''), 'Unknown') AS source,
           COUNT(*) AS lead_count,
           COALESCE(SUM(d.value), 0) AS lead_value
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE ds.name = 'Lead'
      AND ${activeDealFilter}
      AND d.created_at >= ?${ownerClause}
    GROUP BY source
    ORDER BY lead_count DESC, lead_value DESC, source ASC
    LIMIT 5
  `).all(thirtyDaysAgo, ...ownerParams);

  const stageHealth = db.prepare(`
    SELECT ds.name AS stage,
           ds.display_order,
           COALESCE(ds.win_probability, 50) AS win_probability,
           COUNT(d.id) AS deal_count,
           COALESCE(SUM(d.value), 0) AS deal_value,
           COALESCE(SUM(d.value * COALESCE(ds.win_probability, 50) / 100.0), 0) AS weighted_value,
           COALESCE(AVG(julianday('now') - julianday(COALESCE(d.stage_changed_at, d.updated_at, d.created_at))), 0) AS avg_days_in_stage,
           COALESCE(MAX(julianday('now') - julianday(COALESCE(d.stage_changed_at, d.updated_at, d.created_at))), 0) AS max_days_in_stage,
           SUM(CASE WHEN d.sentiment = 'negative' THEN 1 ELSE 0 END) AS negative_deals
    FROM deal_stages ds
    LEFT JOIN deals d
      ON d.stage_id = ds.id
     AND ${activeDealFilter}
     AND ds.is_closed = 0
     ${ownerClause ? 'AND d.owner_id = ?' : ''}
    WHERE ds.is_closed = 0
    GROUP BY ds.id
    ORDER BY ds.display_order
  `).all(...ownerParams).map((row) => ({
    ...row,
    avg_days_in_stage: Math.round(row.avg_days_in_stage || 0),
    max_days_in_stage: Math.round(row.max_days_in_stage || 0),
    weighted_value: Math.round(row.weighted_value || 0),
  }));

  const repLeaderboard = isScoped
    ? db.prepare(`
      SELECT u.id AS user_id, u.name,
        (SELECT COUNT(*) FROM deals d JOIN deal_stages ds ON ds.id = d.stage_id WHERE d.owner_id = u.id AND ds.is_closed = 0 AND COALESCE(d.lifecycle_state, 'active') != 'closed') AS open_deals,
        (SELECT COALESCE(SUM(d.value), 0) FROM deals d JOIN deal_stages ds ON ds.id = d.stage_id WHERE d.owner_id = u.id AND ds.is_closed = 0 AND COALESCE(d.lifecycle_state, 'active') != 'closed') AS open_value,
        (SELECT COUNT(*) FROM deals d JOIN deal_stages ds ON ds.id = d.stage_id WHERE d.owner_id = u.id AND ds.name = 'Won' AND COALESCE(d.lifecycle_state, 'active') != 'closed' AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ?) AS won_last_30,
        (SELECT COALESCE(SUM(d.value), 0) FROM deals d JOIN deal_stages ds ON ds.id = d.stage_id WHERE d.owner_id = u.id AND ds.name = 'Won' AND COALESCE(d.lifecycle_state, 'active') != 'closed' AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ?) AS won_value_last_30,
        (SELECT COUNT(*) FROM deals d JOIN deal_stages ds ON ds.id = d.stage_id WHERE d.owner_id = u.id AND ds.is_closed = 0 AND COALESCE(d.lifecycle_state, 'active') != 'closed' AND julianday('now') - julianday(COALESCE(d.stage_changed_at, d.updated_at, d.created_at)) >= 14) AS at_risk_open
      FROM users u
      WHERE u.id = ?
    `).all(thirtyDaysAgo, thirtyDaysAgo, scopedUserId)
    : db.prepare(`
      SELECT u.id AS user_id, u.name,
        (SELECT COUNT(*) FROM deals d JOIN deal_stages ds ON ds.id = d.stage_id WHERE d.owner_id = u.id AND ds.is_closed = 0 AND COALESCE(d.lifecycle_state, 'active') != 'closed') AS open_deals,
        (SELECT COALESCE(SUM(d.value), 0) FROM deals d JOIN deal_stages ds ON ds.id = d.stage_id WHERE d.owner_id = u.id AND ds.is_closed = 0 AND COALESCE(d.lifecycle_state, 'active') != 'closed') AS open_value,
        (SELECT COUNT(*) FROM deals d JOIN deal_stages ds ON ds.id = d.stage_id WHERE d.owner_id = u.id AND ds.name = 'Won' AND COALESCE(d.lifecycle_state, 'active') != 'closed' AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ?) AS won_last_30,
        (SELECT COALESCE(SUM(d.value), 0) FROM deals d JOIN deal_stages ds ON ds.id = d.stage_id WHERE d.owner_id = u.id AND ds.name = 'Won' AND COALESCE(d.lifecycle_state, 'active') != 'closed' AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ?) AS won_value_last_30,
        (SELECT COUNT(*) FROM deals d JOIN deal_stages ds ON ds.id = d.stage_id WHERE d.owner_id = u.id AND ds.is_closed = 0 AND COALESCE(d.lifecycle_state, 'active') != 'closed' AND julianday('now') - julianday(COALESCE(d.stage_changed_at, d.updated_at, d.created_at)) >= 14) AS at_risk_open
      FROM users u
      WHERE u.role IN ('sales_rep', 'manager') AND u.is_active = 1
      ORDER BY won_value_last_30 DESC, open_value DESC, name ASC
    `).all(thirtyDaysAgo, thirtyDaysAgo);

  const attentionRows = db.prepare(`
    SELECT d.id, d.title, d.value, d.sentiment, d.created_at, d.stage_changed_at,
           ds.name AS stage_name, c.name AS company_name, u.name AS owner_name,
           MAX(a.created_at) AS last_activity_at
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    LEFT JOIN companies c ON c.id = d.company_id
    LEFT JOIN users u ON u.id = d.owner_id
    LEFT JOIN activities a ON a.deal_id = d.id
    WHERE ds.is_closed = 0
      AND ${activeDealFilter}${ownerClause}
    GROUP BY d.id
    ORDER BY d.value DESC, d.created_at DESC
  `).all(...ownerParams);

  const now = Date.now();
  const attention = attentionRows.map((row) => {
    const stageDate = new Date(row.stage_changed_at || row.created_at);
    const lastActivity = row.last_activity_at ? new Date(row.last_activity_at) : null;
    const daysInStage = isNaN(stageDate) ? 0 : Math.max(0, Math.floor((now - stageDate.getTime()) / 86400000));
    const noRecentActivity = !lastActivity || lastActivity < new Date(sevenDaysAgo.replace(' ', 'T'));
    const priorityScore =
      (row.sentiment === 'negative' ? 50 : 0) +
      (noRecentActivity ? 25 : 0) +
      Math.min(daysInStage, 30) +
      Math.min(Math.round((row.value || 0) / 100000), 20);

    return {
      ...row,
      days_in_stage: daysInStage,
      no_recent_activity: noRecentActivity,
      priority_score: priorityScore,
    };
  }).sort((a, b) => b.priority_score - a.priority_score).slice(0, 6);

  // --- Period-over-period comparison ---
  const prevCreated = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(d.value), 0) AS value
    FROM deals d
    WHERE ${activeDealFilter}
      AND d.created_at >= ? AND d.created_at < ?${ownerClause}
  `).get(fourteenDaysAgo, sevenDaysAgo, ...ownerParams);

  const prevWon = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(d.value), 0) AS value
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE ds.name = 'Won'
      AND ${activeDealFilter}
      AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ?
      AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) < ?${ownerClause}
  `).get(sixtyDaysAgo, thirtyDaysAgo, ...ownerParams);

  const prevLost = db.prepare(`
    SELECT COUNT(*) AS count
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE ds.name = 'Lost'
      AND ${activeDealFilter}
      AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ?
      AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) < ?${ownerClause}
  `).get(sixtyDaysAgo, thirtyDaysAgo, ...ownerParams);

  const prevClosedOutcomes = prevWon.count + prevLost.count;
  const prevWinRate = prevClosedOutcomes > 0 ? (prevWon.count / prevClosedOutcomes) * 100 : 0;

  // --- Average sales cycle time ---
  const cycleTime = db.prepare(`
    SELECT COALESCE(AVG(julianday(COALESCE(d.stage_changed_at, d.updated_at, d.created_at)) - julianday(d.created_at)), 0) AS avg_cycle_days
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE ds.name = 'Won'${ownerClause}
  `).get(...ownerParams);

  const closedOutcomes = recentWon.count + recentLost.count;
  const winRateLast30 = closedOutcomes > 0 ? (recentWon.count / closedOutcomes) * 100 : 0;

  // Compute deltas
  function pctDelta(current, previous) {
    if (!previous || previous === 0) return current > 0 ? 100 : null;
    return Math.round(((current - previous) / previous) * 100);
  }

  res.json({
    snapshot: {
      totalDeals: snapshot.total_deals,
      totalValue: snapshot.total_value,
      openDeals: snapshot.open_deals,
      openValue: snapshot.open_value,
      weightedPipelineValue: Math.round(snapshot.weighted_pipeline_value || 0),
      leadStageDeals: snapshot.lead_stage_deals,
      leadStageValue: snapshot.lead_stage_value,
      negativeSentimentDeals: snapshot.negative_sentiment_deals,
      staleDeals: snapshot.stale_deals,
      noActivityLast7Days: noActivityWindow.count,
    },
    movement: {
      newDealsLast7Days: recentCreated.count,
      newValueLast7Days: recentCreated.value,
      newLeadsLast7Days: newLeadsLast7Days.count,
      newLeadValueLast7Days: newLeadsLast7Days.value,
      wonDealsLast30Days: recentWon.count,
      wonValueLast30Days: recentWon.value,
      lostDealsLast30Days: recentLost.count,
      winRateLast30Days: winRateLast30,
      // Period-over-period deltas
      newValueDelta: pctDelta(recentCreated.value, prevCreated.value),
      wonValueDelta: pctDelta(recentWon.value, prevWon.value),
      winRateDelta: pctDelta(winRateLast30, prevWinRate),
      newDealsDelta: pctDelta(recentCreated.count, prevCreated.count),
    },
    avgSalesCycleDays: Math.round(cycleTime.avg_cycle_days || 0),
    stageHealth,
    leadSources,
    repLeaderboard,
    attention,
    recentActivities,
  });
}

function funnelDashboard(req, res) {
  const db = getDb();
  syncDealLifecycleStates(db);
  const isScoped = req.user.role === 'sales_rep' || req.query.my_deals === 'true' || req.query.owner_id;
  const scopedUserId = req.query.owner_id ? parseInt(req.query.owner_id) : req.user.id;
  const ownerClause = isScoped ? ' AND d.owner_id = ?' : '';
  const ownerParams = isScoped ? [scopedUserId] : [];
  const activeDealFilter = `COALESCE(d.lifecycle_state, 'active') != 'closed'`;

  // --- 1. Forecast by month (expected close dates) ---
  const forecastByMonth = db.prepare(`
    SELECT
      strftime('%Y-%m', d.expected_close) AS month,
      COUNT(*) AS deal_count,
      COALESCE(SUM(d.value), 0) AS raw_value,
      COALESCE(SUM(d.value * COALESCE(ds.win_probability, 50) / 100.0), 0) AS weighted_value
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE ds.is_closed = 0
      AND ${activeDealFilter}
      AND d.expected_close IS NOT NULL
      AND d.expected_close >= date('now', '-1 month')
      ${ownerClause}
    GROUP BY month
    ORDER BY month
    LIMIT 6
  `).all(...ownerParams).map(r => ({ ...r, weighted_value: Math.round(r.weighted_value) }));

  const closingSoon = db.prepare(`
    SELECT d.id, d.title, d.value, d.expected_close,
           ds.name AS stage_name, c.name AS company_name, u.name AS owner_name,
           COALESCE(ds.win_probability, 50) AS win_probability
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    LEFT JOIN companies c ON c.id = d.company_id
    LEFT JOIN users u ON u.id = d.owner_id
    WHERE ds.is_closed = 0
      AND ${activeDealFilter}
      AND d.expected_close IS NOT NULL
      AND d.expected_close >= date('now')
      AND d.expected_close <= date('now', '+30 days')
      ${ownerClause}
    ORDER BY d.expected_close ASC
    LIMIT 15
  `).all(...ownerParams);

  // --- 2. Stage conversion funnel ---
  const stageCounts = db.prepare(`
    SELECT ds.name AS stage, ds.display_order, ds.is_closed, COUNT(d.id) AS deal_count
    FROM deal_stages ds
    LEFT JOIN deals d ON d.stage_id = ds.id AND ${activeDealFilter}
      ${ownerClause ? 'AND d.owner_id = ?' : ''}
    GROUP BY ds.id
    ORDER BY ds.display_order
  `).all(...ownerParams);

  const funnelStages = stageCounts.filter(s => !s.is_closed || s.stage === 'Won');
  let cumulative = 0;
  const funnelWithCumulative = [];
  for (let i = funnelStages.length - 1; i >= 0; i--) {
    cumulative += funnelStages[i].deal_count;
    funnelWithCumulative.unshift({ stage: funnelStages[i].stage, deal_count: funnelStages[i].deal_count, entered: cumulative });
  }
  const conversionRates = [];
  for (let i = 0; i < funnelWithCumulative.length - 1; i++) {
    const from = funnelWithCumulative[i];
    const to = funnelWithCumulative[i + 1];
    conversionRates.push({
      from: from.stage, to: to.stage,
      from_count: from.entered, to_count: to.entered,
      rate: from.entered > 0 ? Math.round((to.entered / from.entered) * 100) : 0,
    });
  }

  // --- 3. Lead source conversion rates ---
  const leadSourceConversion = db.prepare(`
    SELECT
      COALESCE(NULLIF(TRIM(d.lead_source), ''), 'Unknown') AS source,
      COUNT(*) AS total_deals,
      SUM(CASE WHEN ds.name = 'Won' THEN 1 ELSE 0 END) AS won_deals,
      SUM(CASE WHEN ds.name = 'Lost' THEN 1 ELSE 0 END) AS lost_deals,
      SUM(CASE WHEN ds.is_closed = 0 THEN 1 ELSE 0 END) AS open_deals,
      COALESCE(SUM(d.value), 0) AS total_value,
      COALESCE(SUM(CASE WHEN ds.name = 'Won' THEN d.value ELSE 0 END), 0) AS won_value
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE 1=1 ${ownerClause}
    GROUP BY source
    ORDER BY total_deals DESC
  `).all(...ownerParams).map(r => ({
    ...r,
    win_rate: (r.won_deals + r.lost_deals) > 0 ? Math.round((r.won_deals / (r.won_deals + r.lost_deals)) * 100) : null,
  }));

  // --- 4. Lost deal breakdown ---
  const lostSummary = db.prepare(`
    SELECT COUNT(*) AS total_lost, COALESCE(SUM(d.value), 0) AS total_lost_value,
           COALESCE(AVG(julianday(COALESCE(d.stage_changed_at, d.updated_at)) - julianday(d.created_at)), 0) AS avg_days_to_loss
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE ds.name = 'Lost' ${ownerClause}
  `).get(...ownerParams);

  const lostByRep = db.prepare(`
    SELECT u.name, COUNT(*) AS lost_count, COALESCE(SUM(d.value), 0) AS lost_value
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    LEFT JOIN users u ON u.id = d.owner_id
    WHERE ds.name = 'Lost' ${ownerClause}
    GROUP BY d.owner_id
    ORDER BY lost_value DESC
  `).all(...ownerParams);

  const recentLostDeals = db.prepare(`
    SELECT d.id, d.title, d.value, d.created_at, d.stage_changed_at,
           c.name AS company_name, u.name AS owner_name,
           ROUND(julianday(COALESCE(d.stage_changed_at, d.updated_at)) - julianday(d.created_at)) AS days_to_loss
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    LEFT JOIN companies c ON c.id = d.company_id
    LEFT JOIN users u ON u.id = d.owner_id
    WHERE ds.name = 'Lost' ${ownerClause}
    ORDER BY COALESCE(d.stage_changed_at, d.updated_at) DESC
    LIMIT 10
  `).all(...ownerParams);

  // Lost deals by value band
  const lostByValue = db.prepare(`
    SELECT
      CASE
        WHEN d.value < 50000 THEN 'Under 50K'
        WHEN d.value < 200000 THEN '50K - 2L'
        WHEN d.value < 500000 THEN '2L - 5L'
        ELSE '5L+'
      END AS band,
      COUNT(*) AS count,
      COALESCE(SUM(d.value), 0) AS value
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE ds.name = 'Lost' ${ownerClause}
    GROUP BY band
    ORDER BY MIN(d.value)
  `).all(...ownerParams);

  // --- 5. Quota/target tracking ---
  const currentMonth = new Date().toISOString().slice(0, 7);
  const targets = db.prepare(`
    SELECT t.id, t.user_id, t.period, t.target_value, u.name
    FROM targets t
    JOIN users u ON u.id = t.user_id
    WHERE t.period = ?
    ORDER BY u.name
  `).all(currentMonth);

  // Get actual won values per rep for current month
  const monthStart = `${currentMonth}-01`;
  const repActuals = db.prepare(`
    SELECT d.owner_id AS user_id, COALESCE(SUM(d.value), 0) AS won_value, COUNT(*) AS won_count
    FROM deals d
    JOIN deal_stages ds ON ds.id = d.stage_id
    WHERE ds.name = 'Won'
      AND COALESCE(d.stage_changed_at, d.updated_at, d.created_at) >= ?
      ${ownerClause}
    GROUP BY d.owner_id
  `).all(monthStart, ...ownerParams);

  const actualsMap = {};
  for (const r of repActuals) actualsMap[r.user_id] = r;

  const quotaTracking = targets.map(t => {
    const actual = actualsMap[t.user_id] || { won_value: 0, won_count: 0 };
    return {
      user_id: t.user_id,
      name: t.name,
      period: t.period,
      target: t.target_value,
      actual: actual.won_value,
      won_count: actual.won_count,
      attainment: t.target_value > 0 ? Math.round((actual.won_value / t.target_value) * 100) : 0,
    };
  });

  res.json({
    forecastByMonth,
    closingSoon,
    conversionRates,
    funnelStages: funnelWithCumulative,
    leadSourceConversion,
    lostDeals: {
      summary: { ...lostSummary, avg_days_to_loss: Math.round(lostSummary.avg_days_to_loss || 0) },
      byRep: lostByRep,
      byValue: lostByValue,
      recent: recentLostDeals,
    },
    quotaTracking,
    currentMonth,
  });
}

function getTargets(req, res) {
  const db = getDb();
  const period = req.query.period || new Date().toISOString().slice(0, 7);
  const targets = db.prepare(`
    SELECT t.*, u.name
    FROM targets t
    JOIN users u ON u.id = t.user_id
    WHERE t.period = ?
    ORDER BY u.name
  `).all(period);
  res.json(targets);
}

function setTarget(req, res) {
  const { user_id, period, target_value } = req.body;
  if (!user_id || !period || target_value === undefined) {
    return res.status(400).json({ error: 'user_id, period, and target_value are required' });
  }
  const db = getDb();
  db.prepare(`
    INSERT INTO targets (user_id, period, target_value) VALUES (?, ?, ?)
    ON CONFLICT(user_id, period) DO UPDATE SET target_value = ?, updated_at = datetime('now')
  `).run(user_id, period, target_value, target_value);
  res.json({ message: 'Target saved' });
}

module.exports = { dashboard, funnelDashboard, getSummary, pipelineValue, repPerformance, dealAging, attention, getTargets, setTarget };
