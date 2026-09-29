import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';

export default function AdminRateLimit() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/rate-limit');
      const d = await r.json();
      if (d.success) setData(d);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <AdminLayout title="Rate Limit">
      {loading && !data ? <p>Memuat...</p> : data && (
        <>
          <div className="admin-stat-grid">
            <div className="stat-card"><span>FREE Default</span><strong>{data.defaults.free}/min</strong></div>
            <div className="stat-card"><span>VIP Default</span><strong>{data.defaults.vip}/min</strong></div>
            <div className="stat-card"><span>DEV Default</span><strong>{data.defaults.dev}/min</strong></div>
            <div className="stat-card"><span>DEV Keys</span><strong>{data.keys.length}</strong></div>
          </div>
          <div className="card">
            <h2>Live DEV Rate Limit</h2>
            <DataTable
              columns={[
                { key: 'id', label: 'Key' },
                { key: 'status', label: 'Status' },
                { key: 'used', label: 'Used/min' },
                { key: 'limit', label: 'Limit/min' },
                { key: 'remaining', label: 'Remaining' },
                { key: 'usageCount', label: 'Total Usage' },
              ]}
              rows={data.keys}
            />
          </div>
        </>
      )}
    </AdminLayout>
  );
}
