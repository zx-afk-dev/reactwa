import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../components/AuthProvider';

function statusLabel(status) {
  if (status === 'success') return '✓ Berhasil';
  if (status === 'failed') return '! Gagal';
  if (status === 'processing') return '↻ Diproses';
  return '… Menunggu';
}

function shortUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname + parsed.pathname;
  } catch {
    return url;
  }
}

export default function ReactionsHistory() {
  const { ready, isGoogleUser, getIdToken } = useAuth();
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function loadHistory(nextPage = 1, nextStatus = status) {
    setLoading(true);
    setMessage('');

    try {
      const token = await getIdToken();
      if (!token) {
        setMessage('Login Google diperlukan untuk membuka riwayat VIP.');
        return;
      }

      const params = new URLSearchParams({
        page: String(nextPage),
        limit: '20',
      });
      if (nextStatus) params.set('status', nextStatus);

      const response = await fetch('/api/reactions/history?' + params.toString(), {
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Gagal mengambil riwayat.');
      }

      setHistory(data.history || []);
      setPage(data.page || nextPage);
      setHasMore(Boolean(data.hasMore));
    } catch (error) {
      setMessage(error?.message || 'Gagal mengambil riwayat.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ready && isGoogleUser) loadHistory(1, '');
  }, [ready, isGoogleUser]);

  function changeStatus(value) {
    setStatus(value);
    loadHistory(1, value);
  }

  return (
    <Layout title="Reaction History — ReactionWA">
      <section style={{ maxWidth: 980, margin: '0 auto' }}>
        <div className="paper-card" style={{ padding: 24, marginBottom: 18 }}>
          <div className="card-label">VIP / ARCHIVE</div>
          <h1 style={{ marginBottom: 8 }}>♾️ Reaction History</h1>
          <p className="muted">
            Riwayat lengkap request reaction VIP, termasuk status, reaction, percobaan,
            dan waktu proses.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
            {[
              ['', 'Semua'],
              ['success', 'Berhasil'],
              ['processing', 'Diproses'],
              ['waiting', 'Menunggu'],
              ['failed', 'Gagal'],
            ].map(([value, label]) => (
              <button
                key={value || 'all'}
                type="button"
                className="emoji-chip"
                style={{ padding: '8px 12px' }}
                onClick={() => changeStatus(value)}
                disabled={loading}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!ready ? (
          <div className="paper-card" style={{ padding: 24 }}>Menyiapkan akun…</div>
        ) : !isGoogleUser ? (
          <div className="paper-card" style={{ padding: 24 }}>
            <h3>🔐 Login diperlukan</h3>
            <p className="muted">Masuk dengan Google untuk menggunakan fitur VIP.</p>
          </div>
        ) : (
          <>
            {message && (
              <div className="paper-card" style={{ padding: 20, marginBottom: 16 }}>
                <b>!</b> {message}
              </div>
            )}

            {loading ? (
              <div className="paper-card" style={{ padding: 24 }}>↻ Memuat riwayat…</div>
            ) : history.length === 0 ? (
              <div className="paper-card" style={{ padding: 24 }}>
                Belum ada riwayat reaction untuk filter ini.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {history.map((item) => (
                  <article key={item.requestId} className="paper-card" style={{ padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <strong>{statusLabel(item.status)}</strong>
                      <small className="muted">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString('id-ID') : '-'}
                      </small>
                    </div>

                    <p style={{ margin: '10px 0 6px', wordBreak: 'break-word' }}>
                      {item.emojis.join(' ')}
                    </p>

                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ wordBreak: 'break-all' }}
                    >
                      {shortUrl(item.url)}
                    </a>

                    <small className="muted" style={{ display: 'block', marginTop: 8 }}>
                      ID: {item.requestId} · Attempt: {item.attempts}
                    </small>

                    {item.errorMessage && (
                      <small style={{ display: 'block', marginTop: 8 }}>
                        {item.errorMessage}
                      </small>
                    )}
                  </article>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 18 }}>
              <button
                type="button"
                className="custom-add-button"
                disabled={loading || page <= 1}
                onClick={() => loadHistory(page - 1, status)}
              >
                ← Sebelumnya
              </button>
              <span style={{ padding: '9px 6px' }}>Halaman {page}</span>
              <button
                type="button"
                className="custom-add-button"
                disabled={loading || !hasMore}
                onClick={() => loadHistory(page + 1, status)}
              >
                Berikutnya →
              </button>
            </div>
          </>
        )}
      </section>
    </Layout>
  );
}
