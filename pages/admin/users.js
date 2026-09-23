import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const resp = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
    const data = await resp.json();
    if (data.success) setItems(data.items);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function doAction(id, action, value) {
    await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, value }),
    });
    load();
  }

  async function remove(id) {
    if (!confirm('Hapus/revoke user ini?')) return;
    await fetch(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    load();
  }

  return (
    <AdminLayout title="Users">
      <div className="admin-toolbar">
        <input className="input" placeholder="Cari identifier user..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-secondary" onClick={load}>Cari</button>
      </div>
      {loading ? <p>Memuat...</p> : (
        <DataTable
          columns={[
            { key: 'id', label: 'Identifier' },
            { key: 'plan', label: 'Plan' },
            { key: 'coin', label: 'Coin' },
            { key: 'suspended', label: 'Suspended', render: (r) => (r.suspended ? 'Ya' : 'Tidak') },
          ]}
          rows={items}
          renderActions={(r) => (
            <div className="row-actions">
              <button className="btn-xs" onClick={() => doAction(r.id, 'adjustCoin', Number(prompt('Tambah/kurangi coin (contoh: 5 atau -3):', '1')) || 0)}>Coin</button>
              <button className="btn-xs" onClick={() => doAction(r.id, 'resetCoin')}>Reset Coin</button>
              <button className="btn-xs" onClick={() => doAction(r.id, r.suspended ? 'unsuspend' : 'suspend')}>{r.suspended ? 'Unsuspend' : 'Suspend'}</button>
              <button className="btn-xs btn-danger" onClick={() => remove(r.id)}>Hapus</button>
            </div>
          )}
        />
      )}
    </AdminLayout>
  );
}
