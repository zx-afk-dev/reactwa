import { useState } from 'react';

const DEFAULT_EMOJIS = ['🥳', '😹', '👍', '❤️', '🔥'];

export default function ReactionForm() {
  const [url, setUrl] = useState('');
  const [emojis, setEmojis] = useState(DEFAULT_EMOJIS);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  function toggleEmoji(emoji) {
    setEmojis((current) => current.includes(emoji)
      ? current.filter((x) => x !== emoji)
      : [...current, emoji]);
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
      setResult({
        ok: response.ok && data.success !== false,
        message: data.message || 'Request selesai.',
        data
      });
    } catch {
      setResult({ ok: false, message: 'Tidak dapat terhubung ke server. Coba lagi.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="reaction-card paper-card tilt-right" onSubmit={submit}>
      <span className="tape tape-yellow" aria-hidden="true" />
      <div className="card-label">ENTRY / 001</div>
      <h2>Leave a little reaction ✎</h2>
      <p className="muted">Tempel link WhatsApp Channel, pilih beberapa emoji, lalu kirim ke antrean reaction.</p>

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
          >
            {emoji}
          </button>
        ))}
      </div>

      <button className="send-button" type="submit" disabled={loading}>
        {loading ? <><span className="spinner" /> Sending note...</> : <>Send reaction <span>→</span></>}
      </button>

      {result && (
        <div className={`result-note ${result.ok ? 'success' : 'error'}`} role="status">
          {result.ok ? '✓ ' : '! '}{result.message}
          {result.data?.data?.task?.key_id && <small> · {result.data.data.task.key_id}</small>}
        </div>
      )}
    </form>
  );
}
