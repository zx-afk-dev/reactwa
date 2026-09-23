import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';

const emptyForm = { rateLimitPerMinute: 60, expiresAt: '', allowedHosts: '', status: 'active', note: '' };

export default function AdminDev() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const resp = await fetch('/api/admin/dev-keys');
    const data = await resp.json();
    if (data.success) setItems(data.items);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    const payload = {
      ...form,
      allowedHosts: form.allowedHosts ? form.allowedHosts.split(',').map((s) => s.trim()).filter(Boolean) : [],
    };
    await fetch('/api/admin/dev-keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setForm(emptyForm);
    load();
  }

  async function toggleStatus(item) {
    await fetch(`/api/admin/dev-keys/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: item.status === 'active' ? 'disabled' : 'active' }),
    });
    load();
  }

  async function remove(id) {
    if (!confirm('Hapus DEV key ini?')) return;
    await fetch(`/api/admin/dev-keys/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <AdminLayout title="DEV Keys">
      <form className="card admin-form" onSubmit={create}>
        <h3>Buat DEV Key Baru</h3>
        <div className="form-grid">
          <label>Rate limit/menit<input className="input" type="number" value={form.rateLimitPerMinute} onChange={(e) => setForm({ ...form, rateLimitPerMinute: Number(e.target.value) })} /></label>
          <label>Expiry (opsional)<input className="input" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></label>
          <label className="full">Allowed Host/Origin (pisahkan koma, kosongkan = bebas)
            <input className="input" value={form.allowedHosts} onChange={(e) => setForm({ ...form, allowedHosts: e.target.value })} placeholder="example.com, *.example.com" />
          </label>
          <label className="full">Catatan<input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        </div>
        <button className="btn btn-primary">Buat Key</button>
      </form>

      {loading ? <p>Memuat...</p> : (
        <DataTable
          columns={[
            { key: 'id', label: 'Key' },
            { key: 'rateLimitPerMinute', label: 'Rate/min' },
            { key: 'allowedHosts', label: 'Allowed Host', render: (r) => (r.allowedHosts && r.allowedHosts.length ? r.allowedHosts.join(', ') : 'Bebas') },
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
                                                                              
