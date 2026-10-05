import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '../components/Layout';
import { useAuth } from '../components/AuthProvider';

const cards = [
  ['Total Reaction', 'total', '✦'],
  ['Berhasil', 'success', '✓'],
  ['Gagal', 'failed', '!'],
  ['Dalam Antrean', 'waiting', '…'],
  ['Diproses', 'processing', '↻'],
  ['7 Hari Terakhir', 'last7Days', '7D'],
];

export default function VipDashboard() {
  const { ready, isGoogleUser, getIdToken } = useAuth();
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadDashboard() {
    setLoading(true);
    setMessage('');

    try {
      const token = await getIdToken();
      if (!token) throw new Error('Login Google diperlukan.');

      const response = await fetch('/api/vip/dashboard', {
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.message || 'Gagal mengambil dashboard.');

      setStats(data.stats || null);
    } catch (error) {
      setMessage(error?.message || 'Gagal mengambil dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ready && isGoogleUser) loadDashboard();
  }, [ready, isGoogleUser]);

  return (
    <Layout title="VIP Dashboard — ReactionWA">
      <section style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div className="paper-card" style={{ padding: 24, marginBottom: 18 }}>
          <div className="card-label">VIP / DASHBOARD</div>
          <h1 style={{ marginBottom: 8 }}>💎 VIP Dashboard</h1>
          <p className="muted">
            Statistik penggunaan reaction dan performa antrean akun VIP kamu.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            <Link className="custom-add-button" href="/reactions">
              ♾️ Riwayat Reaction
            </Link>
            <Link className="custom-add-button" href="/">
              ⚡ Kirim Reaction
            </Link>
          </div>
        </div>

        {!ready ? (
          <div className="paper-card" style={{ padding: 24 }}>Menyiapkan akun…</div>
        ) : !isGoogleUser ? (
          <div className="paper-card" style={{ padding: 24 }}>
            <h3>🔐 Login diperlukan</h3>
            <p className="muted">Masuk dengan Google untuk menggunakan dashboard VIP.</p>
          </div>
        ) : message ? (
          <div className="paper-card" style={{ padding: 24 }}>! {message}</div>
        ) : loading || !stats ? (
          <div className="paper-card" style={{ padding: 24 }}>↻ Memuat statistik VIP…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 12 }}>
              {cards.map(([label, key, icon]) => (
                <article key={key} className="paper-card" style={{ padding: 18 }}>
                  <div style={{ fontSize: 22 }}>{icon}</div>
                  <small className="muted">{label}</small>
                  <strong style={{ display: 'block', fontSize: 28, marginTop: 6 }}>
                    {stats[key].toLocaleString('id-ID')}
                  </strong>
                </article>
              ))}
            </div>

            <article className="paper-card" style={{ padding: 22, marginTop: 12 }}>
              <div className="card-label">PERFORMANCE NOTE</div>
              <h3>🚀 Kecepatan proses</h3>
              <p className="muted">
                Rata-rata waktu proses request yang sudah selesai.
              </p>
              <strong style={{ fontSize: 32 }}>
                {stats.avgProcessingSeconds.toLocaleString('id-ID', {
                  maximumFractionDigits: 2,
                })}s
              </strong>
            </article>
          </>
        )}
      </section>
    </Layout>
  );
}
