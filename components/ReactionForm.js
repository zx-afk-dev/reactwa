import { useEffect, useRef, useState } from 'react';

const DEFAULT_EMOJIS = ['🥳', '😹', '👍', '❤️', '🔥'];

export default function ReactionForm() {
  const [url, setUrl] = useState('');
  const [emojis, setEmojis] = useState(DEFAULT_EMOJIS);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  function toggleEmoji(emoji) {
    setEmojis((current) => current.includes(emoji)
      ? current.filter((x) => x !== emoji)
      : [...current, emoji]);
  }

  async function pollStatus(id) {
    clearInterval(pollRef.current);
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries += 1;
      try {
        const response = await fetch(`/api/reaction-status?id=${encodeURIComponent(id)}`);
        const data = await response.json();
        if (!response.ok) return;

        setResult((current) => ({ ...current, status: data.status, data }));
        if (['success', 'failed'].includes(data.status) || tries >= 24) {
          clearInterval(pollRef.current);
          setLoading(false);
        }
      } catch {}
    }, 2500);
  }

  async function submit(event) {
    event.preventDefault();
    setResult(null);

    if (!url.trim()) return setResult({ ok: false, message: 'Masukkan link WhatsApp Channel terlebih dahulu.' });
    if (!emojis.length) return setResult({ ok: false, message: 'Pilih minimal satu reaction.' });

    setLoading(true);
    try {
      const response = await fetch('/api/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), emojis: emojis.join(',') })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setResult({ ok: false, message: data.message || 'Request ditolak.', data });
        setLoading(false);
        return;
      }

      setResult({
        ok: true,
        message: data.message || 'Request masuk antrean.',
        status: data.status,
        data
      });

      if (data.requestId) pollStatus(data.requestId);
      else setLoading(false);
    } catch {
      setResult({ ok: false, message: 'Tidak dapat terhubung ke server. Coba lagi.' });
      setLoading(false);
    }
  }

  const statusText = {
    waiting: 'menunggu antrean global',
    processing: 'sedang diproses',
    success: 'berhasil diproses',
    failed: 'gagal setelah percobaan ulang'
  };

  return (
    <form className="reaction-card paper-card tilt-right" onSubmit={submit}>
      <span className="tape tape-yellow" aria-hidden="true" />
      <div className="card-label">ENTRY / 001</div>
      <h2>Leave a little reaction ✎</h2>
      <p className="muted">Request masuk ke antrean global terlebih dahulu. Browser tidak menghubungi service reaction secara langsung.</p>

      <label className="field-label" htmlFor="channel-url">Channel post URL</label>
      <input
        id="channel-url"
        className="paper-input"
        type="url"
        placeholder="https://whatsapp.com/channel/.../..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
      />

      <span className="field-label">Your reactions</span>
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

      <button className="send-button" type="submit" disabled={loading}>
        {loading ? <><span className="spinner" /> {result?.status === 'processing' ? 'Processing...' : 'Masuk antrean...'}</> : <>Send reaction <span>→</span></>}
      </button>

      {result && (
        <div className={`result-note ${result.ok ? 'success' : 'error'}`} role="status">
          {result.ok ? '✓ ' : '! '}{result.message}
          {result.status && <><br /><small>Status: {statusText[result.status] || result.status}</small></>}
          {result.data?.queue?.position && <><br /><small>Posisi antrean: #{result.data.queue.position}</small></>}
          {result.data?.requestId && <><br /><small>Request ID: {result.data.requestId}</small></>}
          {result.data?.response?.message && <><br /><small>{result.data.response.message}</small></>}
          {result.data?.error && <><br /><small>{result.data.error}</small></>}
        </div>
      )}
    </form>
  );
}
