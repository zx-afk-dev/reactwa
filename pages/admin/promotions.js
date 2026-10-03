import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

const emptyForm = { title: '', description: '', imageUrl: '', targetUrl: '', type: 'banner', placement: 'all', priority: 0, isActive: true, startAt: '', endAt: '' };

function localValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function PromotionsAdmin() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/promotions');
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message || 'Gagal memuat promosi.');
      setItems(d.promotions || []);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
  }

  function openEdit(item) {
    setEditing(item.id);
    setForm({
      title: item.title, description: item.description, imageUrl: item.imageUrl,
      targetUrl: item.targetUrl, type: item.type, placement: item.placement,
      priority: item.priority, isActive: item.isActive,
      startAt: localValue(item.startAt), endAt: localValue(item.endAt),
    });
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        id: editing || undefined,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
      };
      const r = await fetch('/api/admin/promotions', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message || 'Gagal menyimpan.');
      setEditing(null); setForm(emptyForm); await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function toggle(item) {
    const r = await fetch('/api/admin/promotions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, isActive: !item.isActive }),
    });
    const d = await r.json();
    if (!r.ok || !d.success) return setError(d.message || 'Gagal mengubah status.');
    load();
  }

  async function remove(id) {
    if (!window.confirm('Hapus iklan ini?')) return;
    const r = await fetch('/api/admin/promotions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const d = await r.json();
    if (!r.ok || !d.success) return setError(d.message || 'Gagal menghapus.');
    load();
  }

  const editingOpen = editing !== null || form.title !== '';

  return (
    <AdminLayout title="Promotions">
      <section className="admin-page-head">
        <div>
          <div className="admin-scribble">promotion / ad control</div>
          <h2>Promosi & Iklan</h2>
          <p>Maksimal 3 iklan tampil bersamaan. Jika satu ditutup, slot langsung diisi iklan berikutnya.</p>
        </div>
        <button className="admin-refresh" onClick={openNew}>＋ Tambah iklan</button>
      </section>

      {error && <div className="admin-error">{error}</div>}

      <section className="admin-panel promotion-settings">
        <div><b>Display rule</b><span>Maksimal <strong>3</strong> iklan per halaman · urutan berdasarkan priority terbesar · close akan mengisi slot berikutnya.</span></div>
      </section>

      {loading ? <div className="admin-skeleton">Membaca daftar iklan...</div> : (
        <section className="admin-promo-list">
          {items.map((item) => (
            <article className="admin-panel admin-promo-row" key={item.id}>
              {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <div className="admin-promo-thumb">AD</div>}
              <div className="admin-promo-main">
                <div className="admin-promo-title">
                  <h3>{item.title}</h3>
                  <span className={item.isActive ? 'admin-status ok' : 'admin-status danger'}>{item.isActive ? 'Aktif' : 'Nonaktif'}</span>
                </div>
                <p>{item.description || 'Tanpa deskripsi'}</p>
                <small>Priority {item.priority} · {item.placement} · 👁 {item.impressions.toLocaleString('id-ID')} · 🖱 {item.clicks.toLocaleString('id-ID')}</small>
              </div>
              <div className="admin-actions">
                <button onClick={() => openEdit(item)}>Edit</button>
                <button onClick={() => toggle(item)}>{item.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button>
                <button onClick={() => remove(item.id)}>Hapus</button>
              </div>
            </article>
          ))}
          {!items.length && <div className="admin-panel empty-cell">Belum ada iklan.</div>}
        </section>
      )}

      {editingOpen && (
        <div className="admin-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && (setEditing(null), setForm(emptyForm))}>
          <form className="admin-modal admin-paper" onSubmit={save}>
            <div className="admin-scribble">new promotion card</div>
            <h3>{editing ? 'Edit iklan' : 'Tambah iklan'}</h3>
            <label>Judul<input required maxLength="160" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label>Deskripsi<textarea maxLength="500" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label>URL gambar<input type="url" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." /></label>
            <label>URL tujuan<input type="url" value={form.targetUrl} onChange={(e) => setForm({ ...form, targetUrl: e.target.value })} placeholder="https://..." /></label>
            <div className="admin-form-grid">
              <label>Placement<select value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })}><option value="all">Semua halaman</option><option value="home">Home</option><option value="react">React</option><option value="redeem">Redeem</option></select></label>
              <label>Priority<input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></label>
              <label>Tipe<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="banner">Banner</option><option value="card">Card</option><option value="announcement">Announcement</option></select></label>
              <label>Status<select value={String(form.isActive)} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label>
              <label>Mulai<input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></label>
              <label>Berakhir<input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></label>
            </div>
            <div className="admin-modal-actions">
              <button type="button" onClick={() => { setEditing(null); setForm(emptyForm); }}>Batal</button>
              <button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan iklan'}</button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}
