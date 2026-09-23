import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import StatCard from '../../components/admin/StatCard';

export default function AdminStatistics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/admin/statistics').then((r) => r.json()).then((d) => { if (d.success) setData(d); });
  }, []);

  if (!data) return <AdminLayout title="Statistics"><p>Memuat...</p></AdminLayout>;

  return (
    <AdminLayout title="Statistics">
      <div className="admin-stat-grid">
        <StatCard label="Total Reaction" value={data.total.reaction || 0} />
        <StatCard label="Success" value={data.total.success || 0} />
        <StatCard label="Failed" value={data.total.failed || 0} />
        <StatCard label="Redeem" value={data.total.redeem || 0} />
      </div>
      <div className="card">
        <h3>Harian (30 hari terakhir)</h3>
        <Chart series={data.daily} />
      </div>
      <div className="card">
        <h3>Mingguan</h3>
        <Chart series={data.weekly} />
      </div>
      <div className="card">
        <h3>Bulanan</h3>
        <Chart series={data.monthly} />
      </div>
    </AdminLayout>
  );
}

function Chart({ series }) {
  if (!series || series.length === 0) return <p className="empty-cell">Belum ada data.</p>;
  const max = Math.max(...series.map((s) => s.reaction || 0), 1);
  return (
    <div className="bar-chart">
      {series.map((s) => (
        <div className="bar-col" key={s.key}>
          <div className="bar" style={{ height: `${Math.max(4, (s.reaction || 0) / max * 100)}%` }} title={`${s.key}: ${s.reaction || 0}`} />
          <span className="bar-label">{s.key}</span>
        </div>
      ))}
    </div>
  );
}
