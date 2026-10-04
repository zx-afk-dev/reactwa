import Script from 'next/script';
import { useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@vercel/analytics';
import { useAuth } from './AuthProvider';

const DEFAULT_EMOJIS = ['🥳', '😹', '👍', '❤️', '🔥'];
const FREE_MAX_EMOJIS = 5;
const VIP_MAX_EMOJIS = 30;
const RESET_INTERVAL_MS = 24 * 60 * 60 * 1000;

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}j ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}d`;
  return `${seconds}d`;
}

export default function ReactionForm() {
  const { ready: authReady, getIdToken } = useAuth();
  const [url, setUrl] = useState('');
  const [emojis, setEmojis] = useState(['🥳', '👍']);
  const [customEmoji, setCustomEmoji] = useState('');
  const [plan, setPlan] = useState('FREE');
  const [coin, setCoin] = useState(0);
  const [lastCoinReset, setLastCoinReset] = useState(null);
  const [resetIn, setResetIn] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const recaptchaRef = useRef(null);
  const recaptchaWidgetRef = useRef(null);

  const loadProfile = async () => {
    try {
      const token = await getIdToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const profileResponse = await fetch('/api/me', { cache: 'no-store', headers });
      const profile = await profileResponse.json();

      if (profile.success) {
        setPlan(profile.plan || 'FREE');
        setCoin(Number(profile.coin || 0));
        setLastCoinReset(profile.lastCoinReset ? Number(profile.lastCoinReset) : null);
      }
    } catch {}
  };

  useEffect(() => {
    let active = true;

    if (!recaptchaReady || !recaptchaRef.current || !window.grecaptcha) {
      return () => {
        active = false;
      };
    }

    if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      console.error('NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not configured.');
      return () => {
        active = false;
      };
    }

    window.grecaptcha.ready(() => {
      if (!active || !recaptchaRef.current || recaptchaWidgetRef.current !== null) return;

      try {
        recaptchaWidgetRef.current = window.grecaptcha.render(recaptchaRef.current, {
          sitekey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
          callback: (token) => setRecaptchaToken(token || ''),
          'expired-callback': () => setRecaptchaToken(''),
          'error-callback': () => setRecaptchaToken(''),
        });
      } catch (error) {
        console.error('reCAPTCHA render error:', error);
      }
    });

    return () => {
      active = false;
    };
  }, [recaptchaReady]);

  useEffect(() => {
    let active = true;

    async function loadInitialProfile() {
      try {
        // The server derives the guest identity from the request IP.
        // Do not call a third-party IP echo service from the browser.
        const token = await getIdToken();
        const profileResponse = await fetch('/api/me', {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const profile = await profileResponse.json();

        if (active && profile.success) {
          setPlan(profile.plan || 'FREE');
          setCoin(Number(profile.coin || 0));
          setLastCoinReset(profile.lastCoinReset ? Number(profile.lastCoinReset) : null);
        }
      } catch {}
    }

    if (authReady) loadInitialProfile();

    return () => {
      active = false;
    };
  }, [authReady]);

  useEffect(() => {
    if (plan !== 'FREE' || !lastCoinReset) {
      setResetIn(null);
      return;
    }

    const updateCountdown = async () => {
      const nextReset = Number(lastCoinReset) + RESET_INTERVAL_MS;
      const remaining = nextReset - Date.now();

      if (remaining <= 0) {
        setResetIn(0);
        await loadProfile();
        return;
      }

      setResetIn(remaining);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, [plan, lastCoinReset]);

  const hasCustomSelected = useMemo(
    () => emojis.some((emoji) => !DEFAULT_EMOJIS.includes(emoji)),
    [emojis]
  );

  const cost = hasCustomSelected ? 2 : 1;
  const maxEmojis = plan === 'VIP' ? VIP_MAX_EMOJIS : FREE_MAX_EMOJIS;
  const canAddCustom = customEmoji.trim() && emojis.length < maxEmojis;

  function toggleEmoji(emoji) {
    setEmojis((current) => {
      if (current.includes(emoji)) return current.filter((x) => x !== emoji);
      if (current.length >= maxEmojis) return current;
      return [...current, emoji];
    });
  }

  function addCustomEmoji() {
    const emoji = customEmoji.trim();
    if (!emoji || emojis.length >= maxEmojis || emojis.includes(emoji)) return;
    setEmojis((current) => [...current, emoji]);
    setCustomEmoji('');
  }

  async function waitForQueue(requestId, token) {
    const started = Date.now();
    while (Date.now() - started < 90000) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const response = await fetch(
        `/api/reaction-status?id=${encodeURIComponent(requestId)}`,
        {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Gagal membaca status antrean.');
      }

      if (data.status === 'success') {
        return { ok: true, data };
      }

      if (data.status === 'failed') {
        return {
          ok: false,
          data,
          message: data.errorMessage || 'Reaction gagal diproses.',
        };
      }
    }

    return {
      ok: false,
      timeout: true,
      message: 'Antrean masih diproses. Silakan cek kembali beberapa saat lagi.',
    };
  }

  async function submit(event) {
    event.preventDefault();
    setResult(null);

    if (!url.trim()) {
      setResult({ ok: false, message: 'Masukkan link WhatsApp Channel terlebih dahulu.' });
      return;
    }

    if (!emojis.length) {
      setResult({ ok: false, message: 'Pilih minimal satu reaction.' });
      return;
    }

    if (!recaptchaToken) {
      setResult({ ok: false, message: 'Centang CAPTCHA terlebih dahulu.' });
      return;
    }

    if (plan === 'FREE' && coin < cost) {
      setResult({
        ok: false,
        message: `Coin tidak cukup. Request ini membutuhkan ${cost} coin.`,
      });
      return;
    }

    setLoading(true);

    try {
      const token = await getIdToken();
      const requestId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const requestBody = JSON.stringify({
        requestId,
        url: url.trim(),
        emojis,
        recaptchaToken,
      });

      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: requestBody,
      };

      let response;

      try {
        response = await fetch('/api/react', requestOptions);
      } catch (networkError) {
        // The server may have accepted the request even when the browser
        // lost the HTTP response. Check the idempotent request first.
        const statusResponse = await fetch(
          `/api/reaction-status?id=${encodeURIComponent(requestId)}`,
          {
            cache: 'no-store',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }
        ).catch(() => null);

        if (statusResponse?.ok) {
          response = statusResponse;
        } else {
          // Safe retry: the same requestId can never charge the same request
          // twice because the server handles idempotency atomically.
          response = await fetch('/api/react', requestOptions);
        }
      }

      const data = await response.json().catch(() => ({}));

      setRecaptchaToken('');
      if (window.grecaptcha && recaptchaWidgetRef.current !== null) {
        window.grecaptcha.reset(recaptchaWidgetRef.current);
      }

      if (!response.ok) {
        if (typeof data.coin === 'number') setCoin(data.coin);
        setResult({
          ok: false,
          message: data.message || 'Request ditolak.',
          data,
        });
        return;
      }

      if (typeof data.coin === 'number') setCoin(data.coin);

      // /api/reaction-status is also a valid recovery response after a
      // lost POST response. Normalize it into the same queue flow.
      if (data.requestId === requestId && data.status === 'failed') {
        await loadProfile();
        setResult({
          ok: false,
          message: data.errorMessage || data.message || 'Reaction gagal diproses.',
          data,
        });
        return;
      }

      if (data.requestId === requestId && data.status === 'success') {
        track('Reaction Sent', {
          plan: data.plan || plan,
          customEmoji: Boolean(data.customEmoji),
        });
        await loadProfile();
        setResult({
          ok: true,
          message: data.result?.message || data.message || 'Reaction berhasil dikirim.',
          data,
        });
        return;
      }

      if (data.status === 'waiting' || data.status === 'processing') {
        data.code = 'QUEUED';
      }

      if (data.code === 'QUEUED' && data.requestId) {
        setResult({
          ok: true,
          message: 'Request masuk antrean. Sedang diproses worker...',
          data,
        });

        const queuedResult = await waitForQueue(data.requestId, token);

        if (queuedResult.data?.status === 'success') {
          track('Reaction Sent', {
            plan: data.plan || plan,
            customEmoji: Boolean(data.customEmoji),
          });
          await loadProfile();
          setResult({
            ok: true,
            message: queuedResult.data?.result?.message || 'Reaction berhasil dikirim.',
            data: { ...data, queue: queuedResult.data },
          });
        } else {
          await loadProfile();
          setResult({
            ok: false,
            message: queuedResult.message || queuedResult.data?.errorMessage || 'Reaction gagal diproses.',
            data: { ...data, queue: queuedResult.data },
          });
        }
        return;
      }

      track('Reaction Sent', {
        plan: data.plan || plan,
        customEmoji: Boolean(data.customEmoji),
      });

      setResult({
        ok: true,
        message: data.message || 'Reaction berhasil dikirim.',
        data,
      });
    } catch {
      setResult({
        ok: false,
        message: 'Tidak dapat terhubung ke server. Coba lagi.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Script
        src="https://www.google.com/recaptcha/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setRecaptchaReady(true)}
        onError={() => console.error('Failed to load Google reCAPTCHA script.')}
      />
      <form className="reaction-card paper-card tilt-right" onSubmit={submit}>
      <span className="tape tape-yellow" aria-hidden="true" />

      <div className="card-label">ENTRY / 001</div>
      <div className="account-strip">
        <span className={`plan-badge plan-${plan.toLowerCase()}`}>{plan}</span>
        <span className="coin-badge">🪙 {coin} coin</span>
        {plan === 'FREE' && resetIn !== null && (
          <span className="coin-reset-badge">↻ reset {formatRemaining(resetIn)}</span>
        )}
      </div>

      <h2>Leave a little reaction ✎</h2>
      <p className="muted">
        Request masuk antrean global sebelum diteruskan ke reaction service. Free memakai coin;
        VIP tidak mengurangi coin.
      </p>

      <label className="field-label" htmlFor="channel-url">Channel post URL</label>
      <input
        id="channel-url"
        className="paper-input"
        type="url"
        placeholder="https://whatsapp.com/channel/.../..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={loading}
        required
      />

      <span className="field-label">
        Your reactions <small>(maks. {maxEmojis})</small>
      </span>

      <div className="emoji-row">
        {DEFAULT_EMOJIS.map((emoji) => (
          <button
            type="button"
            key={emoji}
            className={`emoji-chip ${emojis.includes(emoji) ? 'selected' : ''}`}
            onClick={() => toggleEmoji(emoji)}
            disabled={loading}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="custom-emoji-row">
        <input
          className="paper-input"
          type="text"
          inputMode="text"
          maxLength={16}
          placeholder="Emoji custom, contoh: 🚀"
          value={customEmoji}
          onChange={(e) => setCustomEmoji(e.target.value)}
          disabled={loading || emojis.length >= maxEmojis}
        />
        <button
          type="button"
          className="custom-add-button"
          onClick={addCustomEmoji}
          disabled={loading || !canAddCustom}
        >
          + Add
        </button>
      </div>

      <div className="recaptcha-wrap" aria-label="CAPTCHA">
        <div ref={recaptchaRef} />
      </div>

      {hasCustomSelected && (
        <div className="custom-cost-note">
          ✦ Custom emoji memakai <b>2 coin</b> untuk pengguna Free.
        </div>
      )}

      {emojis.length > 0 && (
        <div className="selected-emojis">
          {emojis.map((emoji) => (
            <button
              type="button"
              key={emoji}
              className="selected-tag"
              onClick={() => toggleEmoji(emoji)}
              disabled={loading}
              title="Hapus reaction"
            >
              {emoji} ×
            </button>
          ))}
        </div>
      )}

      <button className="send-button" type="submit" disabled={loading}>
        {loading ? (
          <>
            <span className="spinner" /> Mengirim...
          </>
        ) : (
          <>Send reaction <span>→</span></>
        )}
      </button>

      {result && (
        <div className={`result-note ${result.ok ? 'success' : 'error'}`} role="status">
          {result.ok ? '✓ ' : '! '}{result.message}
          {result.data?.data?.message && (
            <><br /><small>{result.data.data.message}</small></>
          )}
          {result.data?.response?.message && (
            <><br /><small>{result.data.response.message}</small></>
          )}
        </div>
      )}
      </form>
    </>
  );
}
