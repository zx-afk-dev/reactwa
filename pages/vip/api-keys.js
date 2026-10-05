import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../components/AuthProvider';

export default function VipApiKeys() {
  const { ready, isGoogleUser, getIdToken } = useAuth();
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState('');
  const [createdKey, setCreatedKey] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function request(method, body, id) {
    const token = await getIdToken();
    if (!token) throw new Error('Login Google diperlukan.');

    const url = id
      ? '/api/vip/api-keys?id=' + encodeURIComponent(id)
      : '/api/vip/api-keys';

    const response = await fetch(url, {
      method,
      cache: 'no-store',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: 'Bearer ' + token,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Request gagal.');
    return data;
  }

  async function loadKeys() {
    setLoading(true);
    setMessage('');
    try {
      const data = await request('GET');
      setKeys(data.keys || []);
    } catch (error) {
      setMessage(error?.message || 'Gagal mengambil API Key.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ready && isGoogleUser) loadKeys();
  }, [ready, isGoogleUser]);

  async function createKey(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setCreatedKey('');

    try {
      const data = await request('POST', {
        name: name.trim() || 'My API Key',
      });

      setCreatedKey(data.key || '');
      setName('');
      await loadKeys();
    } catch (error) {
      setMessage(error?.message || 'Gagal membuat API Key.');
    } finally {
      setLoading(false);
    }
  }

  async function revokeKey(id) {
    if (!window.confirm('Cabut API Key ini? Key yang dicabut tidak bisa digunakan lagi.')) return;

    setLoading(true);
    setMessage('');
    try {
      await request('DELETE', null, id);
      await loadKeys();
    } catch (error) {
      setMessage(error?.message || 'Gagal mencabut API Key.');
    } finally {
      setLoading(false);
    }
  }

  async function copyKey() {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey).catch(() => {});
    setMessage('API Key disalin.');
  }

  return (
    <Layout title="VIP API Keys — ReactionWA">
      <section style={{ maxWidth: 900, margin: '0 auto' }}>
        <article className="paper-card" style={{ padding: 24, marginBottom: 16 }}>
          <div className="card-label">VIP / API</div>
          <h1>🔑 API Keys</h1>
          <p className="muted">
            Gunakan API Key untuk mengirim reaction tanpa login browser dan tanpa CAPTCHA.
            Batas API VIP: 30 request/menit dan 1.000 request/jam.
          </p>

          {!ready ? (
            <p>Menyiapkan akun…</p>
          ) : !isGoogleUser ? (
            <p className="muted">Login Google diperlukan untuk membuat API Key.</p>
          ) : (
            <form onSubmit={createKey} style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <input
                className="paper-input"
                style={{ flex: '1 1 260px' }}
                placeholder="Nama API Key, contoh: Bot Production"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                disabled={loading}
              />
              <button className="custom-add-button" type="submit" disabled={loading}>
                + Buat API Key
              </button>
            </form>
          )}
        </article>

        {createdKey && (
          <article className="paper-card" style={{ padding: 24, marginBottom: 16 }}>
            <h3>⚠️ Simpan API Key sekarang</h3>
            <p className="muted">
              Secret hanya ditampilkan sekali. Database hanya menyimpan hash API Key.
            </p>
            <code style={{ display: 'block', wordBreak: 'break-all', margin: '12px 0' }}>
              {createdKey}
            </code>
            <button type="button" className="custom-add-button" onClick={copyKey}>
              Salin API Key
            </button>
          </article>
        )}

        {message && (
          <div className="paper-card" style={{ padding: 18, marginBottom: 16 }}>
            {message}
          </div>
        )}

        <article className="paper-card" style={{ padding: 24 }}>
          <div className="card-label">YOUR KEYS</div>
          <h2>API Key aktif</h2>

          {loading && keys.length === 0 ? (
            <p>↻ Memuat…</p>
          ) : keys.length === 0 ? (
            <p className="muted">Belum ada API Key.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {keys.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: 16,
                    border: '1px dashed currentColor',
                    borderRadius: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <strong>{item.name}</strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {item.keyPrefix}•••• · {item.status} · {item.requestCount.toLocaleString('id-ID')} request
                    </div>
                    <small className="muted">
                      Dibuat {item.createdAt ? new Date(item.createdAt).toLocaleString('id-ID') : '-'}
                      {item.lastUsedAt ? ' · terakhir dipakai ' + new Date(item.lastUsedAt).toLocaleString('id-ID') : ''}
                    </small>
                  </div>
                  {item.status === 'active' && (
                    <button
                      type="button"
                      className="custom-add-button"
                      onClick={() => revokeKey(item.id)}
                      disabled={loading}
                    >
                      Cabut
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </Layout>
  );
}
