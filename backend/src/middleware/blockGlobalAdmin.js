const { isGlobalAdmin } = require('../utils/tenant');

function blockGlobalAdmin(req, res, next) {
  if (isGlobalAdmin(req.user)) {
    return res.status(403).json({ error: 'SaaS admins cannot access tenant data' });
  }
  next();
}

module.exports = { blockGlobalAdmin };
