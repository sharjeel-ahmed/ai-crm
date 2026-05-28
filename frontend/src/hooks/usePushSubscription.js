import { useEffect, useRef } from 'react';
import api from '../api/client';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function usePushSubscription() {
  const subscribed = useRef(false);

  useEffect(() => {
    if (subscribed.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    async function subscribe() {
      try {
        if ('Notification' in window && Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;
        }
        if ('Notification' in window && Notification.permission !== 'granted') return;

        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const { data } = await api.get('/push/vapid-key');
        if (!data.publicKey) return;

        const subscribeWithCurrentKey = () => registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        });

        let subscription = await registration.pushManager.getSubscription();
        if (subscription && localStorage.getItem('pushPublicKey') !== data.publicKey) {
          await subscription.unsubscribe();
          subscription = null;
        }

        if (!subscription) {
          try {
            subscription = await subscribeWithCurrentKey();
          } catch (err) {
            if (err?.name !== 'InvalidStateError') throw err;
            const oldSubscription = await registration.pushManager.getSubscription();
            await oldSubscription?.unsubscribe();
            subscription = await subscribeWithCurrentKey();
          }
        }

        if (!subscription) return;

        const subJson = subscription.toJSON();
        await api.post('/push/subscribe', {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        });

        localStorage.setItem('pushPublicKey', data.publicKey);
        subscribed.current = true;
      } catch {
        // Push not supported or permission denied — fall back to in-tab reminders
      }
    }

    subscribe();
  }, []);
}
