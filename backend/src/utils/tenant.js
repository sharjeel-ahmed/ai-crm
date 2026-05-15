const { getDb } = require('../db/connection');

function isGlobalAdmin(user) {
  return Boolean(user && user.role === 'admin' && !user.client_id);
}

function getEffectiveClientId(req, db = getDb()) {
  if (req.user?.client_id) return req.user.client_id;
  const defaultClient = db.prepare('SELECT id FROM clients ORDER BY id LIMIT 1').get();
  return defaultClient?.id || null;
}

function getClientFilter(req, alias, { allowGlobalAdmin = true } = {}) {
  if (allowGlobalAdmin && isGlobalAdmin(req.user)) {
    return { clause: '', params: [] };
  }

  const clientId = req.user?.client_id;
  if (!clientId) {
    return { clause: '', params: [] };
  }

  const qualified = alias ? `${alias}.client_id` : 'client_id';
  return { clause: ` AND ${qualified} = ?`, params: [clientId] };
}

function canAccessClient(req, clientId) {
  return isGlobalAdmin(req.user) || Number(req.user?.client_id) === Number(clientId);
}

module.exports = {
  isGlobalAdmin,
  getEffectiveClientId,
  getClientFilter,
  canAccessClient,
};
