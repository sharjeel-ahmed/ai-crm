const webpush = require('web-push');
const { getDb } = require('../db/connection');

let intervalId = null;
const REMINDER_WINDOW_MS = 15 * 60 * 1000;
const APP_TIMEZONE_OFFSET_MINUTES = Number.parseInt(process.env.ACTIVITY_TIMEZONE_OFFSET_MINUTES || '330', 10);

function parseDueDateMs(value) {
  if (!value) return NaN;
  const raw = String(value).trim();
  if (!raw) return NaN;

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    return new Date(raw).getTime();
  }

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return new Date(raw).getTime();

  const [, year, month, day, hour, minute, second = '0'] = match;
  const utcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  const offsetMinutes = Number.isFinite(APP_TIMEZONE_OFFSET_MINUTES) ? APP_TIMEZONE_OFFSET_MINUTES : 330;
  return utcMs - offsetMinutes * 60000;
}

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

    // Fetch pending reminder candidates and compare times in JS so browser
    // datetime-local values like "2026-05-28T14:30" are handled consistently.
    const activities = db.prepare(`
      SELECT a.id, a.type, a.subject, a.due_date, a.user_id,
        d.title as deal_title, d.id as deal_id
      FROM activities a
      LEFT JOIN deals d ON a.deal_id = d.id
      WHERE a.due_date IS NOT NULL
        AND a.is_completed = 0
        AND a.push_notified_at IS NULL
    `).all();

    if (activities.length === 0) return;

    for (const activity of activities) {
      const dueTime = parseDueDateMs(activity.due_date);
      if (!Number.isFinite(dueTime)) continue;

      const timeUntilDue = dueTime - Date.now();
      if (timeUntilDue <= 0 || timeUntilDue > REMINDER_WINDOW_MS) continue;

      const subscriptions = db.prepare(
        'SELECT * FROM push_subscriptions WHERE user_id = ?'
      ).all(activity.user_id);

      if (subscriptions.length === 0) continue;

      const mins = Math.max(1, Math.round(timeUntilDue / 60000));

      const payload = JSON.stringify({
        title: `Upcoming: ${activity.subject}`,
        body: `${activity.type.charAt(0).toUpperCase() + activity.type.slice(1)} due in ${mins} min${mins !== 1 ? 's' : ''}${activity.deal_title ? ` — ${activity.deal_title}` : ''}`,
        tag: `activity-${activity.id}`,
        url: activity.deal_id ? `/deals/${activity.deal_id}` : '/activities',
      });

      let sentCount = 0;
      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sentCount += 1;
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription expired, clean up
            db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
          } else {
            console.error(`Push notification failed for activity ${activity.id}:`, err.message);
          }
        }
      }

      if (sentCount > 0) {
        db.prepare("UPDATE activities SET push_notified_at = datetime('now') WHERE id = ?")
          .run(activity.id);
      }
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
