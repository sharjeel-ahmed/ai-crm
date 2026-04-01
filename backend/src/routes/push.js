const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { authenticate } = require('../middleware/auth');

// Public - frontend needs this before auth
router.get('/vapid-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(500).json({ error: 'VAPID not configured' });
  res.json({ publicKey: key });
});

router.post('/subscribe', authenticate, (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }

  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)`
  ).run(req.user.id, endpoint, keys.p256dh, keys.auth);

  res.json({ success: true });
});

router.delete('/unsubscribe', authenticate, (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

  const db = getDb();
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
    .run(endpoint, req.user.id);

  res.json({ success: true });
});

module.exports = router;
