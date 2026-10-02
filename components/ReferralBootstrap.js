import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './AuthProvider';

export default function ReferralBootstrap() {
  const router = useRouter();
  const { ready, user, getIdToken } = useAuth();

  useEffect(() => {
    if (!ready || !user || !router.isReady || typeof window === 'undefined') return;

    const code = String(router.query.ref || '').trim().toUpperCase();
    if (!code || code.length < 6) return;

    const storageKey = `reactionwa_referral_${code}`;
    if (window.localStorage.getItem(storageKey)) return;

    let cancelled = false;

    (async () => {
      try {
        const token = await getIdToken();
        if (!token || cancelled) return;

        await fetch('/api/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        const response = await fetch('/api/referral/claim', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ code }),
        });

        const data = await response.json().catch(() => ({}));
        if (response.ok || ['ALREADY_CLAIMED', 'SELF'].includes(data?.reason)) {
          window.localStorage.setItem(storageKey, '1');
        }
      } catch {
        // Referral attribution can retry on the next page load.
      }
    })();

    return () => { cancelled = true; };
  }, [ready, user, router.isReady, router.query.ref, getIdToken]);

  return null;
}
