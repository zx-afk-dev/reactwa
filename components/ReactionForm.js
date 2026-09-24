import { useEffect, useRef, useState } from 'react';
import EmojiPicker from './EmojiPicker';
import CoinDisplay from './CoinDisplay';
import Toast from './Toast';

const EMOJIS = ['🥳', '👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'];
const POLL_INTERVAL_MS = 1500;
const MAX_SELECTED = 3;

function maskIp(ip) {
  if (!ip) return '-';
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.xxx.xxx`;
  return `${ip.slice(0, 6)}***`;
}

export default function ReactionForm() {
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState([]);
  const [customDraft, setCustomDraft] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [ip, setIp] = useState('');
  const [coin, setCoin] = useState(null);
  const [plan, setPlan] = useState('FREE');
  const [planExpiresAt, setPlanExpiresAt] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | validating | waiting | processing | success | failed
  const [message, setMessage] = useState('');
  const [queuePosition, setQueuePosition] = useState(null);
  const [toast, setToast] = useState(null);
  const pollRef = useRef(null);
  const honeypotRef = useRef(null);

  useEffect(() => {
    // Fetched directly from the browser to the public IPify endpoint, per
    // project requirements - no server-side proxy is created for this.
    // Note: the backend independently detects the request IP from headers
    // for actual quota/security purposes, since a client-reported IP can be
    // spoofed and should never be trusted as the sole source of truth.
    fetch('https://api.ipify.org/?format=json')
      .then((r) => r.json())
      .then((d) => setIp(d.ip))
      .catch(() => setIp(''));

    // Tells us whether this browser identity already has an active VIP/DEV
    // plan (from a previously redeemed code on /redeem) so the form can show
    // the right coin cost / plan badge before the first submit.
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        setPlan(d.plan);
        setCoin(d.coin);
        setPlanExpiresAt(d.planExpiresAt);
      })
      .catch(() => {});

    return () => clearInterval(pollRef.current);
  }, []);

  const hasCustom = selected.some((e) => !EMOJIS.includes(e));
  const coinCost = hasCustom ? 2 : 1;
  const isFree = plan === 'FREE';

  function toggleEmoji(emoji) {
    setSelected((prev) => {
      if (prev.includes(emoji)) return prev.filter((e) => e !== emoji);
      if (prev.length >= MAX_SELECTED) {
        setToast({ type: 'error', text: `Maksimal ${MAX_SELECTED} emoji reaction.` });
        return prev;
      }
      return [...prev, emoji];
    });
  }

  function addCustomEmoji() {
    const val = customDraft.trim();
    if (!val) return;
    if (selected.length >= MAX_SELECTED) {
      setToast({ type: 'error', text: `Maksimal ${MAX_SELECTED} emoji reaction.` });
      return;
    }
    if (selected.includes(val)) {
      setToast({ type: 'error', text: 'Emoji ini sudah dipilih.' });
      return;
    }
    setSelected((prev) => [...prev, val]);
    setCustomDraft('');
  }

  function removeCustomEmoji(emoji) {
    setSelected((prev) => prev.filter((e) => e !== emoji));
  }

  function handleStatusUpdate(data) {
    if (data.status === 'waiting') {
      setPhase('waiting');
      setQueuePosition(data.queue?.position ?? null);
      setMessage('Request kamu sedang berada dalam antrean.');
    } else if (data.status === 'processing') {
      setPhase('processing');
      setQueuePosition(null);
      setMessage('Sedang memproses reaction...');
    } else if (data.status === 'success') {
      setPhase('success');
      setMessage('🎉 Reaction berhasil masuk antrean!');
      if (typeof data?.coin?.remaining === 'number') setCoin(data.coin.remaining);
      clearInterval(pollRef.current);
    } else if (data.status === 'failed') {
      setPhase('failed');
      setMessage('Layanan sedang sibuk. Coin kamu dikembalikan. Silakan coba lagi nanti.');
      if (typeof data?.coin?.remaining === 'number') setCoin(data.coin.remaining);
      clearInterval(pollRef.current);
    }
  }

  function startPolling(requestId) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`/api/queue-status?requestId=${encodeURIComponent(requestId)}`);
        const data = await resp.json();
        if (data.success) handleStatusUpdate(data);
      } catch { /* transient network error, next poll will retry */ }
    }, POLL_INTERVAL_MS);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (phase === 'validating' || phase === 'waiting' || phase === 'processing') return;
    if (!url.trim()) return setToast({ type: 'error', text: 'Masukkan URL postingan Saluran WhatsApp.' });
    if (selected.length === 0) return setToast({ type: 'error', text: 'Pilih minimal 1 emoji reaction.' });
    if (!agreeTerms) return setToast({ type: 'error', text: 'Kamu harus menyetujui Ketentuan & Syarat Penggunaan.' });

    setPhase('validating');
    setMessage('Memvalidasi...');
    const requestId = crypto.randomUUID();

    try {
      const resp = await fetch('/api/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          reaction: selected,
          agreeTerms,
          requestId,
          website: honeypotRef.current?.value || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setPhase('idle');
        setMessage('');
        setToast({ type: 'error', text: data.message || 'Terjadi kesalahan.' });
        return;
      }
      if (typeof data?.coin?.remaining === 'number') setCoin(data.coin.remaining);
      handleStatusUpdate(data);
      if (data.status === 'waiting' || data.status === 'processing') startPolling(requestId);
    } catch {
      setPhase('idle');
      setToast({ type: 'error', text: 'Gagal terhubung ke server. Coba lagi.' });
    }
  }

  const busy = phase === 'validating' || phase === 'waiting' || phase === 'processing';
  const canSubmit = !busy;

  return (
    <div className="card reaction-card">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <form onSubmit={handleSubmit}>
        {/* Honeypot field - hidden from real users, bots often fill every input */}
        <input ref={honeypotRef} type="text" name="website" tabIndex={-1} autoComplete="off"
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />

        <label className="field-label">URL Postingan Saluran WhatsApp</label>
        <input
          className="input"
          type="url"
          placeholder="https://whatsapp.com/channel/xxxxxxxx/123"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={!canSubmit}
        />

        <label className="field-label" style={{ marginTop: 18 }}>Pilih Reaction (maks. {MAX_SELECTED})</label>
        <EmojiPicker emojis={EMOJIS} selected={selected} onToggle={toggleEmoji} disabled={!canSubmit} />

        <div className="custom-emoji-row">
          <input
            className="input"
            placeholder="Atau ketik emoji sendiri 😉 (pakai keyboard emoji HP)"
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            disabled={!canSubmit}
            maxLength={16}
          />
          <button type="button" className="btn btn-secondary" onClick={addCustomEmoji} disabled={!canSubmit}>
            Tambah
          </button>
        </div>
        {selected.some((e) => !EMOJIS.includes(e)) && (
          <div className="custom-emoji-chips">
            {selected.filter((e) => !EMOJIS.includes(e)).map((e) => (
              <span className="chip" key={e}>
                {e}
                <button type="button" onClick={() => removeCustomEmoji(e)} disabled={!canSubmit} aria-label="Hapus">✕</button>
              </span>
            ))}
          </div>
        )}
        {hasCustom && isFree && (
          <p className="custom-emoji-note">✨ Kamu memakai emoji custom - biaya request ini <strong>2 coin</strong>.</p>
        )}
        {hasCustom && !isFree && (
          <p className="custom-emoji-note">✨ Emoji custom - gratis untuk plan {plan}.</p>
        )}

        <label className="checkbox-row">
          <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} disabled={!canSubmit} />
          <span>Saya telah membaca dan menyetujui <a href="/terms" target="_blank" rel="noreferrer">Ketentuan &amp; Syarat Penggunaan</a>.</span>
        </label>

        <div className="reaction-footer">
          {isFree ? (
            <CoinDisplay coin={coin} />
          ) : (
            <div className="plan-badge">
              ⭐ Plan {plan}
              {planExpiresAt ? ` · aktif sampai ${new Date(planExpiresAt).toLocaleDateString('id-ID')}` : ''}
            </div>
          )}
          <div className="ip-badge" title="Digunakan sebagai salah satu identitas kuota">IP: {maskIp(ip)}</div>
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={!canSubmit}>
          {!canSubmit ? 'Memproses...' : isFree ? `React Sekarang (${coinCost} coin)` : 'React Sekarang'}
        </button>
      </form>

      {phase !== 'idle' && (
        <div className={`status-box status-${phase}`}>
          {phase === 'waiting' && queuePosition && <div className="queue-position">Posisi antrean: #{queuePosition}</div>}
          <div className="status-message">{message}</div>
        </div>
      )}
    </div>
  );
}
