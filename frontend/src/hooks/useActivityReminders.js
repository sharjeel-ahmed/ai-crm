import { useEffect, useRef } from 'react';
import api from '../api/client';

const POLL_INTERVAL = 60 * 1000; // check every minute
const REMINDER_WINDOW = 15 * 60 * 1000; // 15 minutes before

export default function useActivityReminders() {
  const notifiedIds = useRef(new Set());

  useEffect(() => {
    if (!('Notification' in window)) return;

    // Request permission on mount
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const check = async () => {
      if (Notification.permission !== 'granted') return;

      try {
        const { data: activities } = await api.get('/activities/upcoming?limit=20');
        const now = Date.now();

        for (const activity of activities) {
          if (notifiedIds.current.has(activity.id)) continue;

          const dueTime = new Date(activity.due_date).getTime();
          const timeUntilDue = dueTime - now;

          // Notify if due within 15 minutes (and not already past)
          if (timeUntilDue > 0 && timeUntilDue <= REMINDER_WINDOW) {
            notifiedIds.current.add(activity.id);
            const mins = Math.round(timeUntilDue / 60000);
            new Notification(`Upcoming: ${activity.subject}`, {
              body: `${activity.type.charAt(0).toUpperCase() + activity.type.slice(1)} due in ${mins} min${mins !== 1 ? 's' : ''}${activity.deal_title ? ` — ${activity.deal_title}` : ''}`,
              icon: '/favicon.ico',
              tag: `activity-${activity.id}`,
            });
          }
        }
      } catch {
        // silently ignore auth or network errors
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);
}
