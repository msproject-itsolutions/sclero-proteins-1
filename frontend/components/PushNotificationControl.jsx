'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { getApiUrl } from '../lib/api';

const CLIENT_ID_KEY = 'sclero_push_client_id';

function applicationServerKey(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function browserClientId() {
  let value = window.localStorage.getItem(CLIENT_ID_KEY);
  if (!value) {
    value = window.crypto.randomUUID();
    window.localStorage.setItem(CLIENT_ID_KEY, value);
  }
  return value;
}

export default function PushNotificationControl() {
  const [config, setConfig] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return;
    }
    let cancelled = false;
    fetch(getApiUrl('/api/push/config/'), { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then(async (nextConfig) => {
        if (cancelled || !nextConfig?.enabled || !nextConfig.public_key) return;
        const nextRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        const existing = await nextRegistration.pushManager.getSubscription();
        if (!cancelled) {
          setConfig(nextConfig);
          setRegistration(nextRegistration);
          setSubscribed(Boolean(existing));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!config || !registration) return null;

  const enable = async () => {
    setBusy(true);
    setMessage('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notifications were not enabled in your browser.');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(config.public_key),
      });
      const payload = subscription.toJSON();
      const response = await fetch(getApiUrl('/api/push/subscriptions/'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: payload.endpoint,
          keys: payload.keys,
          client_id: browserClientId(),
        }),
      });
      if (!response.ok) {
        await subscription.unsubscribe();
        throw new Error('The notification subscription could not be saved.');
      }
      setSubscribed(true);
      setMessage('Notifications enabled.');
    } catch (error) {
      setMessage(error.message || 'Notifications could not be enabled.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage('');
    try {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch(getApiUrl('/api/push/subscriptions/'), {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint, client_id: browserClientId() }),
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setMessage('Notifications disabled.');
    } catch {
      setMessage('Notifications could not be disabled. Check your browser settings.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={subscribed ? disable : enable}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/[0.82] transition-colors hover:border-white/35 hover:text-white disabled:opacity-60"
      >
        {subscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        {busy ? 'Updating…' : subscribed ? 'Disable notifications' : 'Enable notifications'}
      </button>
      {message && <p className="max-w-xs text-xs text-white/65" aria-live="polite">{message}</p>}
    </div>
  );
}
