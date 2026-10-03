import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/logs?limit=80');
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message || 'Gagal memuat log');
      setLogs(d.logs || []);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <AdminLayout title="Logs">
      <section className="admin-page-head">
        <div><div className="admin-scribble">paper trail / audit notes</div><h2>Activity logs</h2><p>Catatan perubahan admin dan event penting yang tersimpan di Supabase.</p></div>
        <button className="admin-refresh" onClick={load}>↻ Refresh</button>
      </section>
      {error && <div className="admin-error">{error}</div>}
      <section className="admin-log-list">
        {loading ? <div className="admin-skeleton">Membaca catatan...</div> : logs.length ? logs.map((log) => (
          <article className="admin-log-card" key={log.id}>
            <div className="admin-log-pin" />
            <div className="admin-log-head"><span className="admin-log-type">{log.type}</span><time>{log.createdAt ? new Date(log.createdAt).toLocaleString('id-ID') : '—'}</time></div>
            <p>{log.message}</p>
            {Object.keys(log.meta || {}).length > 0 && <details><summary>Lihat metadata</summary><pre>{JSON.stringify(log.meta, null, 2)}</pre></details>}
          </article>
        )) : <div className="admin-panel empty-cell">Belum ada log.</div>}
      </section>
    </AdminLayout>
  );
}