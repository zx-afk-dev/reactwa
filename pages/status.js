import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';

export default function StatusPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/status').then((r) => r.json()).then((d) => { if (d.success) setData(d); });
  }, []);

  return (
    <Layout title="Status" description="Status layanan ReactionWA secara real-time.">
      <section className="page-header">
        <h1>Status Layanan</h1>
        <p>Statistik publik ReactionWA.</p>
      </section>
      {!data ? (
        <p className="loading-text">Memuat...</p>
      ) : (
        <>
          <div className="status-grid">
            <StatusBadge online={data.service === 'online'} label={data.service === 'online' ? 'Service: Online' : 'Service: Maintenance'} />
            <StatusBadge online={data.queue === 'normal'} label="Queue: Normal" />
          </div>
          {data.maintenance && (
            <div className="card maintenance-card">
              <strong>{data.maintenance.title}</strong>
              <p>{data.maintenance.description}</p>
              {data.maintenance.eta && <p>Estimasi selesai: {data.maintenance.eta}</p>}
            </div>
          )}
          <div className="stats-grid">
            <div className="card stat-card"><span className="stat-value">{data.stats.reactionThisWeek.toLocaleString('id-ID')}</span><span className="stat-label">Reaction minggu ini</span></div>
            <div className="card stat-card"><span className="stat-value">{data.stats.totalReaction.toLocaleString('id-ID')}</span><span className="stat-label">Total reaction</span></div>
            <div className="card stat-card"><span className="stat-value">{data.stats.freeUsers.toLocaleString('id-ID')}</span><span className="stat-label">Pengguna Free</span></div>
            <div className="card stat-card"><span className="stat-value">{data.stats.totalUsers.toLocaleString('id-ID')}</span><span className="stat-label">Total pengguna</span></div>
          </div>
        </>
      )}
    </Layout>
  );
}
