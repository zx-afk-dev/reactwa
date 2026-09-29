import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';
import StatCard from '../../components/admin/StatCard';

export default function AdminQueue() {
  const [data, setData] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    const resp = await fetch('/api/admin/queue');
    const d = await resp.json();
    if (d.success) setData(d);
  }

  async function processQueue() {
    if (processing) return;

    setProcessing(true);
    setMessage('');

    try {
      const resp = await fetch('/api/admin/queue/process', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const d = await resp.json();

      if (resp.ok && d.success) {
        setMessage(d.message || 'Antrean selesai diproses.');
        await load();
      } else {
        setMessage(d.message || 'Gagal memproses antrean.');
      }
    } catch {
      setMessage('Tidak dapat terhubung ke server.');
    } finally {
      setProcessing(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <AdminLayout title="Queue"><p>Memuat...</p></AdminLayout>;

  return (
    <AdminLayout title="Queue">
      <div className="admin-toolbar">
        <button
          type="button"
          className="btn btn-primary"
          onClick={processQueue}
          disabled={processing}
        >
          {processing ? 'Memproses...' : '▶ Proses Antrian'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={load}
          disabled={processing}
        >
          ↻ Refresh
        </button>
      </div>

      {message && <div className="admin-alert" role="status">{message}</div>}

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
