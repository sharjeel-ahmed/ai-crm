const { getDb } = require('../db/connection');

function listTables(req, res) {
  const db = getDb();
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  const result = tables.map((t) => {
    const count = db.prepare(`SELECT COUNT(*) AS c FROM "${t.name}"`).get();
    return { name: t.name, row_count: count.c };
  });

  res.json(result);
}

function getTableData(req, res) {
  const db = getDb();
  const { name } = req.params;

  const exists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?
  `).get(name);
  if (!exists) return res.status(404).json({ error: 'Table not found' });

  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  const columns = db.prepare(`PRAGMA table_info("${name}")`).all();
  const total = db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get().c;

  const orderClause = columns.find((c) => c.name === 'id') ? 'ORDER BY id DESC' : '';
  const rows = db.prepare(
    `SELECT * FROM "${name}" ${orderClause} LIMIT ? OFFSET ?`
  ).all(limit, offset);

  res.json({
    table: name,
    columns: columns.map((c) => ({ name: c.name, type: c.type, pk: !!c.pk, notnull: !!c.notnull })),
    rows,
    total,
    limit,
    offset,
  });
}

module.exports = { listTables, getTableData };
