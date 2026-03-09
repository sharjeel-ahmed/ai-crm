const { getDb } = require('../db/connection');

function dashboard(req, res) {
  const db = getDb();
  const scope = req.user.role === 'sales_rep' ? { where: 'WHERE d.owner_id = ?', params: [req.user.id] } : { where: '', params: [] };

  const totalDeals = db.prepare(`SELECT COUNT(*) as count FROM deals d ${scope.where}`).get(...scope.params);
  const totalValue = db.prepare(`SELECT COALESCE(SUM(d.value), 0) as total FROM deals d ${scope.where}`).get(...scope.params);
  const wonDeals = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(d.value), 0) as total FROM deals d
    JOIN deal_stages ds ON d.stage_id = ds.id
    WHERE ds.name = 'Won' ${req.user.role === 'sales_rep' ? 'AND d.owner_id = ?' : ''}
  `).get(...scope.params);
  const activeDeals = db.prepare(`
    SELECT COUNT(*) as count FROM deals d
    JOIN deal_stages ds ON d.stage_id = ds.id
    WHERE ds.is_closed = 0 ${req.user.role === 'sales_rep' ? 'AND d.owner_id = ?' : ''}
  `).get(...scope.params);
  const recentActivities = db.prepare(`
    SELECT a.*, u.name as user_name FROM activities a
    LEFT JOIN users u ON a.user_id = u.id
    ${req.user.role === 'sales_rep' ? 'WHERE a.user_id = ?' : ''}
    ORDER BY a.created_at DESC LIMIT 10
  `).all(...scope.params);

  res.json({
    totalDeals: totalDeals.count,
    totalValue: totalValue.total,
    wonDeals: wonDeals.count,
    wonValue: wonDeals.total,
    activeDeals: activeDeals.count,
    recentActivities,
  });
}

function pipelineValue(req, res) {
  const db = getDb();
  const scope = req.user.role === 'sales_rep' ? 'AND d.owner_id = ?' : '';
  const params = req.user.role === 'sales_rep' ? [req.user.id] : [];

  const data = db.prepare(`
    SELECT ds.name as stage, ds.display_order, COUNT(d.id) as count, COALESCE(SUM(d.value), 0) as value
    FROM deal_stages ds
    LEFT JOIN deals d ON ds.id = d.stage_id ${scope ? `AND d.owner_id = ?` : ''}
    GROUP BY ds.id
    ORDER BY ds.display_order
  `).all(...params);
  res.json(data);
}

function repPerformance(req, res) {
  const db = getDb();
  const data = db.prepare(`
    SELECT u.name, u.id as user_id,
      COUNT(d.id) as total_deals,
      COALESCE(SUM(d.value), 0) as total_value,
      SUM(CASE WHEN ds.name = 'Won' THEN 1 ELSE 0 END) as won_deals,
      COALESCE(SUM(CASE WHEN ds.name = 'Won' THEN d.value ELSE 0 END), 0) as won_value
    FROM users u
    LEFT JOIN deals d ON u.id = d.owner_id
    LEFT JOIN deal_stages ds ON d.stage_id = ds.id
    WHERE u.role IN ('sales_rep', 'manager')
    GROUP BY u.id
    ORDER BY won_value DESC
  `).all();
  res.json(data);
}

function dealAging(req, res) {
  const db = getDb();
  const scopeJoin = req.user.role === 'sales_rep' ? 'AND d.owner_id = ?' : '';
  const params = req.user.role === 'sales_rep' ? [req.user.id] : [];

  const deals = db.prepare(`
    SELECT d.id, d.title, d.value, d.stage_changed_at, d.created_at,
      ds.name as stage, ds.display_order
    FROM deals d
    JOIN deal_stages ds ON d.stage_id = ds.id
    WHERE ds.is_closed = 0 ${scopeJoin}
    ORDER BY ds.display_order
  `).all(...params);

  const now = Date.now();
  // Aggregate: avg and max days per stage, plus individual deals
  const stageMap = {};
  for (const d of deals) {
    const dateStr = d.stage_changed_at || d.created_at;
    const parsed = new Date(dateStr);
    const days = isNaN(parsed) ? 0 : Math.max(0, Math.floor((now - parsed.getTime()) / 86400000));

    if (!stageMap[d.stage]) {
      stageMap[d.stage] = { stage: d.stage, display_order: d.display_order, avg_days: 0, max_days: 0, deal_count: 0, total_days: 0, deals: [] };
    }
    const s = stageMap[d.stage];
    s.total_days += days;
    s.deal_count += 1;
    if (days > s.max_days) s.max_days = days;
    s.deals.push({ id: d.id, title: d.title, value: d.value, days_in_stage: days });
  }

  const result = Object.values(stageMap)
    .map(s => ({ ...s, avg_days: Math.round(s.total_days / s.deal_count) }))
    .sort((a, b) => a.display_order - b.display_order);

  res.json(result);
}

module.exports = { dashboard, pipelineValue, repPerformance, dealAging };
