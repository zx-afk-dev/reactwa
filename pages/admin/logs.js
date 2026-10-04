import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

const FILTERS = [
  { key: 'all', label: 'Semua', icon: '✦' },
  { key: 'success', label: 'Success', icon: '✓' },
  { key: 'error', label: 'Error', icon: '!' },
  { key: 'info', label: 'Info', icon: 'i' },
  { key: 'auth', label: 'Auth', icon: '⌁' },
  { key: 'admin', label: 'Admin', icon: '◆' },
];

const CATEGORY_LABEL = {
  success: 'SUCCESS',
  error: 'ERROR',
  info: 'INFO',
  auth: 'AUTH',
  admin: 'ADMIN',
};

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);

    try {
      const r = await fetch('/api/admin/logs?limit=200');
      const d = await r.json();

      if (!r.ok || !d.success) {
        throw new Error(d.message || 'Gagal memuat log');
      }

      setLogs(d.logs || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const result = { all: logs.length, success: 0, error: 0, info: 0, auth: 0, admin: 0 };

    for (const log of logs) {
      if (result[log.category] !== undefined) {
        result[log.category] += 1;
      }
    }

    return result;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((log) => {
      if (filter !== 'all' && log.category !== filter) return false;
      if (!query) return true;

      const haystack = [
        log.type,
        log.message,
        JSON.stringify(log.meta || {}),
      ].join(' ').toLowerCase();

      return haystack.includes(query);
    });
  }, [logs, filter, search]);

  return (
    <AdminLayout title="Logs">
      <section className="admin-page-head">
        <div>
          <div className="admin-scribble">paper trail / audit notes</div>
          <h2>Activity logs</h2>
          <p>Filter event berdasarkan status agar error, success, auth, dan aktivitas admin lebih mudah dicari.</p>
        </div>

        <button className="admin-refresh" onClick={load} disabled={loading}>
          {loading ? '↻ Membaca...' : '↻ Refresh'}
        </button>
      </section>

      {error && <div className="admin-error">{error}</div>}

      <section className="admin-log-toolbar">
        <div className="admin-log-filters">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`admin-log-filter ${filter === item.key ? 'active' : ''} ${item.key}`}
              onClick={() => setFilter(item.key)}
            >
              <span>{item.icon}</span>
              {item.label}
              <b>{counts[item.key]}</b>
            </button>
          ))}
        </div>

        <div className="admin-log-search">
          <span>⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari event, pesan, request ID..."
            aria-label="Cari log"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Hapus pencarian">
              ×
            </button>
          )}
        </div>

        <div className="admin-log-summary">
          Menampilkan <b>{filteredLogs.length}</b> dari <b>{logs.length}</b> log
        </div>
      </section>

      <section className="admin-log-list">
        {loading ? (
          <div className="admin-skeleton">Membaca catatan...</div>
        ) : filteredLogs.length ? (
          filteredLogs.map((log) => (
            <article className={`admin-log-card category-${log.category || 'info'}`} key={log.id}>
              <div className="admin-log-pin" />

              <div className="admin-log-head">
                <div className="admin-log-title">
                  <span className={`admin-log-badge ${log.category || 'info'}`}>
                    {CATEGORY_LABEL[log.category] || 'INFO'}
                  </span>
                  <span className="admin-log-type">{log.type}</span>
                </div>
                <time>
                  {log.createdAt ? new Date(log.createdAt).toLocaleString('id-ID') : '—'}
                </time>
              </div>

              <p>{log.message || 'Tidak ada pesan.'}</p>

              {Object.keys(log.meta || {}).length > 0 && (
                <details>
                  <summary>Lihat metadata</summary>
                  <pre>{JSON.stringify(log.meta, null, 2)}</pre>
                </details>
              )}
            </article>
          ))
        ) : (
          <div className="admin-panel empty-cell">
            {search || filter !== 'all'
              ? 'Tidak ada log yang cocok dengan filter.'
              : 'Belum ada log.'}
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
