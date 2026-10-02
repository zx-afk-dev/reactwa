import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

const EMPTY = { enabled: false, title: '', description: '', eta: '' };

export default function AdminMaintenance() {
  const [maintenance, setMaintenance] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/maintenance');
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message || 'Gagal memuat pengaturan.');
      setMaintenance(d.maintenance || EMPTY);
      setMessage('');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const r = await fetch('/api/admin/maintenance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maintenance }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message || 'Gagal menyimpan.');
      setMaintenance(d.maintenance);
      setMessage(d.maintenance.enabled ? 'Maintenance berhasil diaktifkan.' : 'Maintenance berhasil dimatikan.');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AdminLayout title="Maintenance" eyebrow="SERVICE CONTROL"><div className="admin-skeleton">Membuka catatan service...</div></AdminLayout>;
  }

  return (
    <AdminLayout title="Maintenance" eyebrow="SERVICE CONTROL">
      <section className="admin-maintenance-page">
        <div className="admin-maintenance-paper">
          <div className="admin-scribble">service switch / admin only</div>
          <div className="admin-maintenance-head">
            <div>
              <h2>Maintenance mode</h2>
              <p>Kontrol sementara untuk menghentikan request reaction dari halaman publik.</p>
            </div>
            <button
              type="button"
              className={`admin-toggle ${maintenance.enabled ? 'active' : ''}`}
              onClick={() => setMaintenance((x) => ({ ...x, enabled: !x.enabled }))}
            >
              <span /> {maintenance.enabled ? 'AKTIF' : 'NONAKTIF'}
            </button>
          </div>

          <div className="admin-maintenance-status">
            <span className={maintenance.enabled ? 'dot on' : 'dot'} />
            {maintenance.enabled
              ? 'Publik akan menerima respons 503 Maintenance.'
              : 'Layanan reaction berjalan normal.'}
          </div>

          <label>Judul maintenance</label>
          <input value={maintenance.title || ''} maxLength={200}
            onChange={(e) => setMaintenance({ ...maintenance, title: e.target.value })}
            placeholder="Maintenance sementara" />

          <label>Pesan untuk pengguna</label>
          <textarea value={maintenance.description || ''} maxLength={1000} rows={5}
            onChange={(e) => setMaintenance({ ...maintenance, description: e.target.value })}
            placeholder="Layanan sedang diperbaiki. Silakan coba lagi nanti." />

          <label>Perkiraan selesai</label>
          <input value={maintenance.eta || ''} maxLength={100}
            onChange={(e) => setMaintenance({ ...maintenance, eta: e.target.value })}
            placeholder="Contoh: sekitar 30 menit" />

          <div className="admin-maintenance-actions">
            <button className="admin-save" disabled={saving} onClick={save}>
              {saving ? 'Menyimpan...' : 'Simpan perubahan'}
            </button>
            <button className="admin-refresh" disabled={saving} onClick={load}>↻ Muat ulang</button>
          </div>

          {message && <div className="admin-maintenance-message">{message}</div>}
        </div>

        <aside className="admin-note yellow">
          <b>Catatan:</b><br />
          Maintenance hanya memblokir request reaction. Dashboard dan panel admin tetap dapat digunakan.
        </aside>
      </section>
    </AdminLayout>
  );
}
