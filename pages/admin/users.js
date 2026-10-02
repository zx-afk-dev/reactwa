import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

function toLocalInput(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function UserRow({ user, onAction, onEdit }) {
  const plan = user.plan || 'FREE';
  return (
    <tr>
      <td><code title={user.identifier}>{user.identifier?.slice(0, 16)}…</code></td>
      <td><span className={`admin-plan ${plan.toLowerCase()}`}>{plan}</span></td>
      <td><b>{Number(user.coin || 0).toLocaleString('id-ID')}</b></td>
      <td>{user.suspended ? <span className="admin-status danger">Suspended</span> : <span className="admin-status ok">Active</span>}</td>
      <td className="admin-actions">
        <button onClick={() => onEdit(user)}>Edit</button>
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
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ plan: 'FREE', coin: 0, expiry: '' });

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
    setError('');
    const r = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: user.identifier, action }),
    });
    const d = await r.json();
    if (!r.ok || !d.success) return setError(d.message || 'Aksi gagal');
    setUsers((list) => list.map((x) => x.identifier === user.identifier ? { ...x, ...d.user } : x));
  }

  function openEdit(user) {
    setEditing(user);
    setForm({
      plan: user.plan || 'FREE',
      coin: Number(user.coin || 0),
      expiry: toLocalInput(user.planExpiresAt),
    });
    setError('');
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      const expiry = form.expiry ? new Date(form.expiry).getTime() : null;
      const r = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: editing.identifier,
          action: 'edit',
          plan: form.plan,
          coin: Number(form.coin),
          planExpiresAt: expiry,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message || 'Gagal menyimpan user');
      setUsers((list) => list.map((x) => x.identifier === editing.identifier ? { ...x, ...d.user } : x));
      setEditing(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const filtered = users.filter((u) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return String(u.identifier).toLowerCase().includes(needle) || String(u.plan).toLowerCase().includes(needle);
  });

  return (
    <AdminLayout title="Users">
      <section className="admin-page-head">
        <div>
          <div className="admin-scribble">people / anonymous identities</div>
          <h2>User archive</h2>
          <p>Kelola plan, coin, expiry, dan status akses tanpa menampilkan IP asli.</p>
        </div>
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
              {filtered.map((user) => <UserRow key={user.identifier} user={user} onAction={action} onEdit={openEdit} />)}
              {!filtered.length && <tr><td colSpan="5" className="empty-cell">Tidak ada user.</td></tr>}
            </tbody>
          </table>
        )}
      </section>

      {editing && (
        <div className="admin-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}>
          <form className="admin-modal admin-paper" onSubmit={saveEdit}>
            <div className="admin-scribble">edit archive card</div>
            <h3>Edit user</h3>
            <p className="admin-modal-id"><code>{editing.identifier}</code></p>

            <label>Plan
              <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                <option value="FREE">FREE</option>
                <option value="VIP">VIP</option>
                <option value="DEV">DEV</option>
              </select>
            </label>

            <label>Coin
              <input type="number" min="0" max="1000000000" value={form.coin} onChange={(e) => setForm({ ...form, coin: e.target.value })} />
            </label>

            <label>Expiry VIP / DEV
              <input type="datetime-local" value={form.expiry} disabled={form.plan === 'FREE'} onChange={(e) => setForm({ ...form, expiry: e.target.value })} />
            </label>

            <div className="admin-modal-actions">
              <button type="button" onClick={() => setEditing(null)}>Batal</button>
              <button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan perubahan'}</button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}