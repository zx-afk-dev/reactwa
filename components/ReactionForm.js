import { useState } from 'react';

const DEFAULT_EMOJIS = ['🥳', '😹', '👍', '❤️', '🔥'];

export default function ReactionForm() {
  const [url, setUrl] = useState('');
  const [emojis, setEmojis] = useState(DEFAULT_EMOJIS);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  function toggleEmoji(emoji) {
    setEmojis((current) =>
      current.includes(emoji)
        ? current.filter((x) => x !== emoji)
        : [...current, emoji]
    );
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

    setLoading(true);

    try {
      const response = await fetch('/api/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          emojis: emojis.join(','),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setResult({
          ok: false,
          message: data.message || 'Request ditolak.',
          data,
        });
        return;
      }

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
      <h2>Leave a little reaction ✎</h2>
      <p className="muted">
        Request dikirim langsung ke reaction service melalui server ReactionWA.
        Tidak ada antrean global.
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
