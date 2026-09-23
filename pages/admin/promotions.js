import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';

const emptyForm = { title: '', description: '', buttonLabel: '', url: '', active: true, startDate: '', endDate: '' };

export default function AdminPromotions() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const resp = await fetch('/api/admin/promotions');
    const data = await resp.json();
    if (data.success) setItems(data.items);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    await fetch('/api/admin/promotions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm(emptyForm);
    load();
  }

  async function toggleActive(item) {
    await fetch(`/api/admin/promotions/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    });
    load();
  }

  async function remove(id) {
    if (!confirm('Hapus promosi ini?')) return;
    await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <AdminLayout title="Promotions">
      <form className="card admin-form" onSubmit={create}>
        <h3>Buat Promosi Baru</h3>
        <div className="form-grid">
          <label>Judul<input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>Button Label<input className="input" value={form.buttonLabel} onChange={(e) => setForm({ ...form, buttonLabel: e.target.value })} /></label>
          <label>URL<input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></label>
          <label>Mulai<input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
          <label>Berakhir<input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
          <label className="full">Deskripsi<input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        </div>
        <button className="btn btn-primary">Buat Promosi</button>
      </form>

      {loading ? <p>Memuat...</p> : (
        <DataTable
          columns={[
            { key: 'title', label: 'Judul' },
            { key: 'active', label: 'Aktif', render: (r) => (r.active ? 'Ya' : 'Tidak') },
            { key: 'startDate', label: 'Mulai' },
            { key: 'endDate', label: 'Berakhir' },
          ]}
          rows={items}
          renderActions={(r) => (
            <div className="row-actions">
              <button className="btn-xs" onClick={() => toggleActive(r)}>{r.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
              <button className="btn-xs btn-danger" onClick={() => remove(r.id)}>Hapus</button>
            </div>
          )}
        />
      )}
    </AdminLayout>
  );
}
