import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';

const emptyForm = { coin: 0, durationDays: 30, expiresAt: '' };

export default function AdminRedeem() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    try {
      const resp = await fetch('/api/admin/redeem-codes');
      const data = await resp.json();
      if (data.success) setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    setCreating(true);
    setNotice('');

    try {
      const resp = await fetch('/api/admin/redeem-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        setNotice(data.message || 'Gagal membuat VIP key.');
        return;
      }

      setNotice(`VIP key berhasil dibuat: ${data.id}`);
      setForm(emptyForm);
      await load();
    } catch {
      setNotice('Gagal terhubung ke server.');
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(item) {
    await fetch(`/api/admin/redeem-codes/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: item.status === 'active' ? 'disabled' : 'active',
      }),
    });
    load();
  }

  async function remove(id) {
    if (!confirm('Hapus VIP key ini?')) return;
    await fetch(`/api/admin/redeem-codes/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <AdminLayout title="VIP Keys">
      <section className="admin-page-head">
        <div>
          <div className="admin-scribble">vip / key generator</div>
          <h2>VIP keys</h2>
          <p>Setiap key otomatis single-use dan dapat memberi bonus coin + durasi VIP.</p>
        </div>
        <button className="admin-refresh" onClick={load}>↻ Refresh</button>
      </section>

      <form className="admin-panel admin-form" onSubmit={create}>
        <div className="admin-panel-head">
          <div><span className="admin-scribble">new key</span><h3>Buat VIP key</h3></div>
          <span className="admin-status ok">SINGLE USE</span>
        </div>

        <div className="form-grid">
          <label>Bonus coin
            <input className="input" type="number" min="0" max="1000000000" value={form.coin}
              onChange={(e) => setForm({ ...form, coin: Number(e.target.value) })} />
          </label>
          <label>Durasi VIP (hari)
            <input className="input" type="number" min="1" max="3650" value={form.durationDays}
              onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })} />
          </label>
          <label>Expiry key (opsional)
            <input className="input" type="date" value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </label>
        </div>

        <p className="admin-help-note">
          Key yang berhasil diredeem akan otomatis berstatus <b>used</b> dan tidak dapat digunakan lagi.
        </p>

        <button className="admin-save" disabled={creating}>
          {creating ? 'Membuat key…' : 'Buat VIP Key →'}
        </button>

        {notice && <div className="admin-maintenance-message">{notice}</div>}
      </form>

      <section style={{ marginTop: 24 }}>
        {loading ? <div className="admin-skeleton">Membaca daftar VIP key…</div> : (
          <DataTable
            columns={[
              { key: 'id', label: 'Key' },
              { key: 'coin', label: 'Coin', render: (r) => `+${Number(r.coin || 0)}` },
              { key: 'durationDays', label: 'Durasi', render: (r) => `${r.durationDays || 30} hari` },
              { key: 'usedCount', label: 'Usage', render: (r) => `${r.usedCount || 0}/1` },
              { key: 'status', label: 'Status' },
            ]}
            rows={items}
            renderActions={(r) => (
              <div className="row-actions">
                {r.status !== 'used' && (
                  <button className="btn-xs" onClick={() => toggleStatus(r)}>
                    {r.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                )}
                <button className="btn-xs btn-danger" onClick={() => remove(r.id)}>Hapus</button>
              </div>
            )}
          />
        )}
      </section>
    </AdminLayout>
  );
}
