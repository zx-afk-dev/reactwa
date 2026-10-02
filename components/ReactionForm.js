import { useEffect, useMemo, useState } from 'react';
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
  const [visitorIp, setVisitorIp] = useState('');
  const [plan, setPlan] = useState('FREE');
  const [coin, setCoin] = useState(0);
  const [lastCoinReset, setLastCoinReset] = useState(null);
  const [resetIn, setResetIn] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ipLoading, setIpLoading] = useState(true);
  const [result, setResult] = useState(null);

  const loadProfile = async (ip = visitorIp) => {
    const token = await getIdToken();
    try {
      const endpoint = ip
        ? `/api/me?ip=${encodeURIComponent(ip)}`
        : '/api/me';

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const profileResponse = await fetch(endpoint, { cache: 'no-store', headers });
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

    async function loadInitialProfile() {
      try {
        const ipResponse = await fetch('https://api.ipify.org/?format=json');
        const ipData = await ipResponse.json();
        const ip = typeof ipData?.ip === 'string' ? ipData.ip.trim() : '';

        if (!ip) throw new Error('IP tidak ditemukan.');
        if (!active) return;

        setVisitorIp(ip);

        const profileResponse = await fetch(
          `/api/me?ip=${encodeURIComponent(ip)}`,
          { cache: 'no-store' }
        );
        const profile = await profileResponse.json();

        if (active && profile.success) {
          setPlan(profile.plan || 'FREE');
          setCoin(Number(profile.coin || 0));
          setLastCoinReset(profile.lastCoinReset ? Number(profile.lastCoinReset) : null);
        }
      } catch {
        try {
          const profileResponse = await fetch('/api/me', { cache: 'no-store' });
          const profile = await profileResponse.json();

          if (active && profile.success) {
            setPlan(profile.plan || 'FREE');
            setCoin(Number(profile.coin || 0));
            setLastCoinReset(profile.lastCoinReset ? Number(profile.lastCoinReset) : null);
          }
        } catch {}
      } finally {
        if (active) setIpLoading(false);
      }
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
      const response = await fetch('/api/react', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          url: url.trim(),
          emojis,
          visitorIp,
        }),
      });

      const data = await response.json().catch(() => ({}));

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
      if (data.lastCoinReset) setLastCoinReset(Number(data.lastCoinReset));

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
    <form className="reaction-card paper-card tilt-right" onSubmit={submit}>
      <span className="tape tape-yellow" aria-hidden="true" />

      <div className="card-label">ENTRY / 001</div>
      <div className="account-strip">
        <span className={`plan-badge plan-${plan.toLowerCase()}`}>{plan}</span>
        <span className="coin-badge">🪙 {coin} coin</span>
        {plan === 'FREE' && resetIn !== null && (
          <span className="coin-reset-badge">↻ reset {formatRemaining(resetIn)}</span>
        )}
        {ipLoading && <span className="ip-status">checking IP…</span>}
      </div>

      <h2>Leave a little reaction ✎</h2>
      <p className="muted">
        Request dikirim langsung ke reaction service. Free memakai coin;
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

      <button className="send-button" type="submit" disabled={loading || ipLoading}>
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
  );
}
