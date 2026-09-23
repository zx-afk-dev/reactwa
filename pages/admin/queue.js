import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';
import StatCard from '../../components/admin/StatCard';

export default function AdminQueue() {
  const [data, setData] = useState(null);

  async function load() {
    const resp = await fetch('/api/admin/queue');
    const d = await resp.json();
    if (d.success) setData(d);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <AdminLayout title="Queue"><p>Memuat...</p></AdminLayout>;

  return (
    <AdminLayout title="Queue">
      <div className="admin-stat-grid">
        <StatCard label="Waiting" value={data.waiting} />
        <StatCard label="Processing" value={data.processing} />
        <StatCard label="Lock" value={data.lock ? 'Terkunci' : 'Bebas'} />
      </div>
      <div className="card">
        <h3>Riwayat Terbaru</h3>
        <DataTable
          columns={[
            { key: 'id', label: 'Request ID' },
            { key: 'plan', label: 'Plan' },
            { key: 'status', label: 'Status' },
          ]}
          rows={data.recent}
        />
      </div>
    </AdminLayout>
  );
}
