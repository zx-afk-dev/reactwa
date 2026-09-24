import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';

const emptyForm = { type: 'coin', coin: 10, maxUses: 100, durationDays: 30, expiresAt: '', status: 'active' };

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

  const isPlanType = form.type === 'vip' || form.type === 'dev';

  return (
    <AdminLayout title="Redeem Codes">
      <form className="card admin-form" onSubmit={create}>
        <h3>Buat Redeem Code Baru</h3>
        <div className="form-grid">
          <label>Tipe Kode
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="coin">Coin</option>
              <option value="vip">VIP (upgrade plan)</option>
              <option value="dev">DEV (upgrade plan)</option>
            </select>
          </label>
          <label>Maksimal Penggunaan<input className="input" type="number" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: Number(e.target.value) })} /></label>
          <label>{isPlanType ? 'Coin Bonus (opsional)' : 'Coin'}<input className="input" type="number" value={form.coin} onChange={(e) => setForm({ ...form, coin: Number(e.target.value) })} /></label>
          {isPlanType && (
            <label>Durasi Plan (hari)<input className="input" type="number" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })} /></label>
          )}
          <label>Expiry Kode (opsional)<input className="input" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></label>
        </div>
        {isPlanType && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -4, marginBottom: 12 }}>
            Kode tipe {form.type.toUpperCase()} akan meng-upgrade plan identitas (browser) yang menukarkannya di halaman
            /redeem selama {form.durationDays} hari, lalu otomatis kembali ke Free.
          </p>
        )}
        <button className="btn btn-primary">Buat Kode</button>
      </form>

      {loading ? <p>Memuat...</p> : (
        <DataTable
          columns={[
            { key: 'id', label: 'Kode' },
            { key: 'type', label: 'Tipe', render: (r) => (r.type || 'coin').toUpperCase() },
            { key: 'coin', label: 'Coin', render: (r) => r.coin || 0 },
            { key: 'durationDays', label: 'Durasi', render: (r) => (r.type === 'vip' || r.type === 'dev') ? `${r.durationDays || 30} hari` : '-' },
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
