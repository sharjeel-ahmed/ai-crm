const { getDb } = require('../db/connection');

function getAll(req, res) {
  const db = getDb();
  const stages = db.prepare('SELECT * FROM deal_stages ORDER BY display_order').all();
  res.json(stages);
}

function create(req, res) {
  const { name, display_order, is_closed } = req.body;
  if (!name) return res.status(400).json({ error: 'Stage name required' });

  const db = getDb();
  const maxOrder = db.prepare('SELECT COALESCE(MAX(display_order), 0) + 1 as next FROM deal_stages').get();
  const result = db.prepare('INSERT INTO deal_stages (name, display_order, is_closed) VALUES (?, ?, ?)')
    .run(name, display_order || maxOrder.next, is_closed ? 1 : 0);
  const stage = db.prepare('SELECT * FROM deal_stages WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(stage);
}

function update(req, res) {
  const { name, display_order, is_closed } = req.body;
  const db = getDb();
  const stage = db.prepare('SELECT * FROM deal_stages WHERE id = ?').get(req.params.id);
  if (!stage) return res.status(404).json({ error: 'Stage not found' });

  db.prepare('UPDATE deal_stages SET name = ?, display_order = ?, is_closed = ? WHERE id = ?')
    .run(name || stage.name, display_order !== undefined ? display_order : stage.display_order, is_closed !== undefined ? (is_closed ? 1 : 0) : stage.is_closed, req.params.id);
  const updated = db.prepare('SELECT * FROM deal_stages WHERE id = ?').get(req.params.id);
  res.json(updated);
}

function remove(req, res) {
  const db = getDb();
  const dealsInStage = db.prepare('SELECT COUNT(*) as count FROM deals WHERE stage_id = ?').get(req.params.id);
  if (dealsInStage.count > 0) {
    return res.status(400).json({ error: 'Cannot delete stage with existing deals' });
  }
  const result = db.prepare('DELETE FROM deal_stages WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Stage not found' });
  res.json({ message: 'Stage deleted' });
}

module.exports = { getAll, create, update, remove };
