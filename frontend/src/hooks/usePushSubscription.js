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
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const { data } = await api.get('/push/vapid-key');
        if (!data.publicKey) return;

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(data.publicKey),
          });
        }

        const subJson = subscription.toJSON();
        await api.post('/push/subscribe', {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        });

        subscribed.current = true;
      } catch {
        // Push not supported or permission denied — fall back to in-tab reminders
      }
    }

    subscribe();
  }, []);
}
