import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

function UserRow({ user, onAction }) {
  const plan = user.plan || 'FREE';
  return (
    <tr>
      <td><code title={user.identifier}>{user.identifier?.slice(0, 16)}…</code></td>
      <td><span className={`admin-plan ${plan.toLowerCase()}`}>{plan}</span></td>
      <td><b>{Number(user.coin || 0).toLocaleString('id-ID')}</b></td>
      <td>{user.suspended ? <span className="admin-status danger">Suspended</span> : <span className="admin-status ok">Active</span>}</td>
      <td className="admin-actions">
        <button onClick={() => onAction(user, 'add10')}>+10</button>
        <button onClick={() => onAction(user, 'remove10')}>−10</button>
        <button onClick={() => onAction(user, user.suspended ? 'unsuspend' : 'suspend')}>{user.suspended ? 'Unsuspend' : 'Suspend'}</button>
      </td>
    </tr>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/users');
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message || 'Gagal memuat users');
      setUsers(d.users || []);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function action(user, action) {
    const r = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: user.identifier, action }),
    });
    const d = await r.json();
    if (!r.ok || !d.success) return setError(d.message || 'Aksi gagal');
    setUsers((list) => list.map((x) => x.identifier === user.identifier ? { ...x, ...d.user } : x));
  }

  const filtered = users.filter((u) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return String(u.identifier).toLowerCase().includes(needle) || String(u.plan).toLowerCase().includes(needle);
  });

  return (
    <AdminLayout title="Users">
      <section className="admin-page-head">
        <div><div className="admin-scribble">people / anonymous identities</div><h2>User archive</h2><p>Profil anonim, plan, coin, dan status akses.</p></div>
        <button className="admin-refresh" onClick={load}>↻ Refresh</button>
      </section>

      <div className="admin-toolbar">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari identifier atau plan..." />
        <span>{filtered.length} user ditampilkan</span>
      </div>

      {error && <div className="admin-error">{error}</div>}
      <section className="admin-panel table-wrap">
        {loading ? <div className="admin-skeleton">Membaca user archive...</div> : (
          <table className="admin-table">
            <thead><tr><th>Identifier</th><th>Plan</th><th>Coin</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {filtered.map((user) => <UserRow key={user.identifier} user={user} onAction={action} />)}
              {!filtered.length && <tr><td colSpan="5" className="empty-cell">Tidak ada user.</td></tr>}
            </tbody>
          </table>
        )}
      </section>
    </AdminLayout>
  );
}
