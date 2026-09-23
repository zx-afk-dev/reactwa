import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import StatCard from '../../components/admin/StatCard';

export default function AdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/admin/dashboard').then((r) => r.json()).then((d) => { if (d.success) setData(d); });
  }, []);

  return (
    <AdminLayout title="Dashboard">
      {!data ? <p>Memuat...</p> : (
        <>
          <div className="admin-stat-grid">
            <StatCard label="Total User" value={data.total.users || 0} />
            <StatCard label="User Free" value={data.total.users_free || 0} />
            <StatCard label="User VIP" value={data.total.users_vip || 0} />
            <StatCard label="User Dev" value={data.total.users_dev || 0} />
            <StatCard label="Total Reaction" value={data.total.reaction || 0} />
            <StatCard label="Success" value={data.total.success || 0} />
            <StatCard label="Failed" value={data.total.failed || 0} />
            <StatCard label="Queue Waiting" value={data.queueWaiting || 0} />
            <StatCard label="Redeem" value={data.total.redeem || 0} />
          </div>

          <div className="card">
            <h3>Reaction 14 Hari Terakhir</h3>
            <SimpleBarChart series={data.daily} />
          </div>

          {data.maintenance?.enabled && (
            <div className="admin-alert">Maintenance sedang aktif: {data.maintenance.title}</div>
          )}
        </>
      )}
    </AdminLayout>
  );
}

function SimpleBarChart({ series }) {
  if (!series || series.length === 0) return <p className="empty-cell">Belum ada data.</p>;
  const max = Math.max(...series.map((s) => s.reaction || 0), 1);
  return (
    <div className="bar-chart">
      {series.map((s) => (
        <div className="bar-col" key={s.key}>
          <div className="bar" style={{ height: `${Math.max(4, (s.reaction || 0) / max * 100)}%` }} title={`${s.key}: ${s.reaction || 0}`} />
          <span className="bar-label">{s.key?.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}
