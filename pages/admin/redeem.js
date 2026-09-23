import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';

const emptyForm = { coin: 10, maxUses: 100, expiresAt: '', status: 'active' };

export default function AdminRedeem() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const resp = await fetch('/api/admin/redeem-codes');
    const data = await resp.json();
    if (data.success) setItems(data.items);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    await fetch('/api/admin/redeem-codes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm(emptyForm);
    load();
  }

  async function toggleStatus(item) {
    await fetch(`/api/admin/redeem-codes/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: item.status === 'active' ? 'disabled' : 'active' }),
    });
    load();
  }

  async function remove(id) {
    if (!confirm('Hapus redeem code ini?')) return;
    await fetch(`/api/admin/redeem-codes/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <AdminLayout title="Redeem Codes">
      <form className="card admin-form" onSubmit={create}>
        <h3>Buat Redeem Code Baru</h3>
        <div className="form-grid">
          <label>Coin<input className="input" type="number" value={form.coin} onChange={(e) => setForm({ ...form, coin: Number(e.target.value) })} /></label>
          <label>Maksimal Penggunaan<input className="input" type="number" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: Number(e.target.value) })} /></label>
          <label>Expiry (opsional)<input className="input" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></label>
        </div>
        <button className="btn btn-primary">Buat Kode</button>
      </form>

      {loading ? <p>Memuat...</p> : (
        <DataTable
          columns={[
            { key: 'id', label: 'Kode' },
            { key: 'coin', label: 'Coin' },
            { key: 'usedCount', label: 'Digunakan', render: (r) => `${r.usedCount || 0}/${r.maxUses || '∞'}` },
            { key: 'status', label: 'Status' },
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
