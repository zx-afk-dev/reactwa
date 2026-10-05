import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { useAuth } from '../components/AuthProvider';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value + 'T00:00:00').toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
  });
}

export default function VipApiAnalytics() {
  const { ready, isGoogleUser, getIdToken } = useAuth();
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Login Google diperlukan.');

      const response = await fetch('/api/vip/api-analytics', {
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + token },
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || 'Gagal mengambil analytics.');

      setData(json);
    } catch (error) {
      setMessage(error?.message || 'Gagal mengambil analytics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ready && isGoogleUser) load();
  }, [ready, isGoogleUser]);

  return (
    <Layout title="VIP API Analytics — ReactionWA">
      <section style={{ maxWidth: 1000, margin: '0 auto' }}>
        <article className="paper-card" style={{ padding: 24, marginBottom: 16 }}>
          <div className="card-label">VIP / API ANALYTICS</div>
          <h1>📊 API Analytics</h1>
          <p className="muted">
            Pantau penggunaan API Key VIP kamu tanpa menampilkan secret API Key.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <Link className="custom-add-button" href="/vip/api-keys">🔑 API Keys</Link>
            <Link className="custom-add-button" href="/vip">💎 Dashboard VIP</Link>
          </div>
        </article>

        {!ready ? (
          <article className="paper-card" style={{ padding: 24 }}>Menyiapkan akun…</article>
        ) : !isGoogleUser ? (
          <article className="paper-card" style={{ padding: 24 }}>
            🔐 Login Google diperlukan.
          </article>
        ) : message ? (
          <article className="paper-card" style={{ padding: 24 }}>! {message}</article>
        ) : loading || !data ? (
          <article className="paper-card" style={{ padding: 24 }}>↻ Memuat analytics…</article>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
              gap: 12,
            }}>
              {[
                ['Total API Request', data.stats.totalRequests],
                ['7 Hari', data.stats.last7Days],
                ['30 Hari', data.stats.last30Days],
                ['API Key Aktif', data.stats.activeKeys],
              ].map(([label, value]) => (
                <article className="paper-card" style={{ padding: 18 }} key={label}>
                  <small className="muted">{label}</small>
                  <strong style={{ display: 'block', fontSize: 28, marginTop: 6 }}>
                    {value.toLocaleString('id-ID')}
                  </strong>
                </article>
              ))}
            </div>

            <article className="paper-card" style={{ padding: 22, marginTop: 12 }}>
              <div className="card-label">14 DAYS</div>
              <h2>Penggunaan harian</h2>
              {data.daily.length === 0 ? (
                <p className="muted">Belum ada penggunaan API.</p>
              ) : (
                <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                  {data.daily.map((item) => {
                    const max = Math.max(...data.daily.map((x) => x.requests), 1);
                    const width = Math.max(2, Math.round((item.requests / max) * 100));
                    return (
                      <div key={item.date}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          marginBottom: 4,
                        }}>
                          <small>{formatDate(item.date)}</small>
                          <small><b>{item.requests.toLocaleString('id-ID')}</b> request</small>
                        </div>
                        <div style={{
                          height: 9,
                          border: '1px solid currentColor',
                          borderRadius: 999,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: width + '%',
                            height: '100%',
                            background: 'currentColor',
                            opacity: 0.22,
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          </>
        )}
      </section>
    </Layout>
  );
}
