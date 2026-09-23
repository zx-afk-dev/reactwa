import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';

const emptyForm = { rateLimitPerMinute: 20, coin: 0, expiresAt: '', benefit: '', status: 'active' };

export default function AdminVip() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const resp = await fetch('/api/admin/vip-keys');
    const data = await resp.json();
    if (data.success) setItems(data.items);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    await fetch('/api/admin/vip-keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm(emptyForm);
    load();
  }

  async function toggleStatus(item) {
    await fetch(`/api/admin/vip-keys/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: item.status === 'active' ? 'disabled' : 'active' }),
    });
    load();
  }

  async function remove(id) {
    if (!confirm('Hapus VIP key ini?')) return;
    await fetch(`/api/admin/vip-keys/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <AdminLayout title="VIP Keys">
      <form className="card admin-form" onSubmit={create}>
        <h3>Buat VIP Key Baru</h3>
        <div className="form-grid">
          <label>Coin<input className="input" type="number" value={form.coin} onChange={(e) => setForm({ ...form, coin: Number(e.target.value) })} /></label>
          <label>Rate limit/menit<input className="input" type="number" value={form.rateLimitPerMinute} onChange={(e) => setForm({ ...form, rateLimitPerMinute: Number(e.target.value) })} /></label>
          <label>Expiry (opsional)<input className="input" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></label>
          <label>Benefit<input className="input" value={form.benefit} onChange={(e) => setForm({ ...form, benefit: e.target.value })} placeholder="Prioritas antrean, dll" /></label>
        </div>
        <button className="btn btn-primary">Buat Key</button>
      </form>

      {loading ? <p>Memuat...</p> : (
        <DataTable
          columns={[
            { key: 'id', label: 'Key' },
            { key: 'coin', label: 'Coin' },
            { key: 'rateLimitPerMinute', label: 'Rate/min' },
            { key: 'status', label: 'Status' },
            { key: 'usageCount', label: 'Usage', render: (r) => r.usageCount || 0 },
          ]}
          rows={items}
          renderActions={(r) => (
            <div className="row-actions">
              <button className="btn-xs" onClick={() => toggleStatus(r)}>{r.status === 'active' ? 'Disable' : 'Enable'}</button>
              <button className="btn-xs btn-danger" onClick={() => remove(r.id)}>Hapus</button>
            </div>
          )}
        />
      )}
    </AdminLayout>
  );
}
