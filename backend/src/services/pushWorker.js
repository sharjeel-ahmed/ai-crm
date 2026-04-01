const webpush = require('web-push');
const { getDb } = require('../db/connection');

let intervalId = null;

function configure() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@pazo.com';

  if (!publicKey || !privateKey) {
    console.log('Push worker: VAPID keys not configured, skipping');
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

async function runCycle() {
  try {
    const db = getDb();

    // Find activities due within 15 minutes that haven't been push-notified
    const activities = db.prepare(`
      SELECT a.id, a.type, a.subject, a.due_date, a.user_id,
        d.title as deal_title, d.id as deal_id
      FROM activities a
      LEFT JOIN deals d ON a.deal_id = d.id
      WHERE a.due_date IS NOT NULL
        AND a.is_completed = 0
        AND a.push_notified_at IS NULL
        AND a.due_date > datetime('now')
        AND a.due_date <= datetime('now', '+15 minutes')
    `).all();

    if (activities.length === 0) return;

    for (const activity of activities) {
      const subscriptions = db.prepare(
        'SELECT * FROM push_subscriptions WHERE user_id = ?'
      ).all(activity.user_id);

      if (subscriptions.length === 0) continue;

      const dueTime = new Date(activity.due_date).getTime();
      const mins = Math.max(1, Math.round((dueTime - Date.now()) / 60000));

      const payload = JSON.stringify({
        title: `Upcoming: ${activity.subject}`,
        body: `${activity.type.charAt(0).toUpperCase() + activity.type.slice(1)} due in ${mins} min${mins !== 1 ? 's' : ''}${activity.deal_title ? ` — ${activity.deal_title}` : ''}`,
        tag: `activity-${activity.id}`,
        url: activity.deal_id ? `/deals/${activity.deal_id}` : '/activities',
      });

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription expired, clean up
            db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
          }
        }
      }

      // Mark as notified so we don't send again
      db.prepare("UPDATE activities SET push_notified_at = datetime('now') WHERE id = ?")
        .run(activity.id);
    }
  } catch (err) {
    console.error('Push worker error:', err.message);
  }
}

function startWorker(intervalMs = 60000) {
  if (intervalId) return;
  if (!configure()) return;

  console.log('Push notification worker started (interval: 60s)');
  runCycle();
  intervalId = setInterval(runCycle, intervalMs);
}

function stopWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = { startWorker, stopWorker };
