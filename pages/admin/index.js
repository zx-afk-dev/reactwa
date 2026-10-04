import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

function Metric({ label, value, note, tone = '' }) {
  return (
    <div className={`admin-metric ${tone}`}>
      <span>{label}</span>
      <strong>{Number(value || 0).toLocaleString('id-ID')}</strong>
      <small>{note}</small>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const r = await fetch('/api/admin/dashboard');
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message || 'Gagal memuat dashboard');
      setData(d);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  if (!data && !error) {
    return <AdminLayout title="Overview"><div className="admin-skeleton">Membuka catatan statistik...</div></AdminLayout>;
  }

  if (error) {
    return <AdminLayout title="Overview"><div className="admin-error">{error}<button onClick={load}>Coba lagi</button></div></AdminLayout>;
  }

  const total = data.total || {};
  const daily = data.daily || [];
  const max = Math.max(...daily.map((x) => Number(x.reaction || 0)), 1);

  return (
    <AdminLayout title="Overview">
      <section className="admin-welcome">
        <div>
          <div className="admin-scribble">today's control notes</div>
          <h2>Selamat datang di ruang admin.</h2>
          <p>Ringkasan layanan, pengguna, dan aktivitas reaction dalam satu tempat.</p>
        </div>
        <div className="admin-stamp">LIVE<br /><b>DIRECT FLOW</b></div>
      </section>

      {data.maintenance?.enabled && (
        <div className="admin-maintenance">⚠ Maintenance aktif — {data.maintenance.title}</div>
      )}

      <div className="admin-metric-grid">
        <Metric label="TOTAL USERS" value={total.users} note="semua profil" tone="blue" />
        <Metric label="FREE" value={total.users_free} note="plan aktif" />
        <Metric label="VIP" value={total.users_vip} note="plan aktif" tone="yellow" />
        <Metric label="DEV" value={total.users_dev} note="plan aktif" tone="red" />
        <Metric label="REACTIONS" value={total.reaction} note="emoji terkirim" tone="blue" />
        <Metric label="SUCCESS" value={total.success} note="request berhasil" />
        <Metric label="FAILED" value={total.failed} note="request gagal" tone="red" />
        <Metric label="REDEEM" value={total.redeem} note="kode digunakan" tone="yellow" />
      </div>

      <section className="admin-panel paper-grid">
        <div className="admin-panel-head">
          <div><span className="admin-scribble">activity / 14 days</span><h3>Reaction activity</h3></div>
          <button className="admin-refresh" onClick={load}>↻ Refresh</button>
        </div>
        <div className="admin-chart">
          {daily.map((item) => {
            const height = Math.max(5, (Number(item.reaction || 0) / max) * 100);
            return (
              <div className="admin-bar-wrap" key={item.key}>
                <div className="admin-bar-value">{Number(item.reaction || 0).toLocaleString('id-ID')}</div>
                <div className="admin-bar" style={{ height: `${height}%` }} />
                <small>{item.key?.slice(5)}</small>
              </div>
            );
          })}
        </div>
      </section>

      <div className="admin-note-row">
        <div className="admin-note blue">Server validates first.<br /><b>Then queue + worker.</b></div>
        <div className="admin-note yellow">Coin is billed by plan.<br /><b>Custom emoji = 2 coins.</b></div>
        <div className="admin-note red">Global queue is active.<br /><b>Worker processes requests.</b></div>
      </div>
    </AdminLayout>
  );
}
